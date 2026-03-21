import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { db } from '../db';
import { users, playerProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import type { AppEnv } from '../lib/types';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

async function createToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

export const authRoutes = new Hono();

// Rate limit tracking (in-memory, resets on restart — fine for MVP)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(key);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count++;
  return true;
}

// Schemas
const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const appleAuthSchema = z.object({
  appleId: z.string().min(1),
  email: z.string().email().optional(),
  fullName: z.string().optional(),
});

// Email signup
authRoutes.post('/signup', async (c) => {
  const body = await c.req.json();
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;

  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const hash = await bcrypt.hash(password, 12);

  const [user] = await db
    .insert(users)
    .values({ email, passwordHash: hash })
    .returning();

  // Create empty profile
  await db.insert(playerProfiles).values({ userId: user.id });

  const token = await createToken(user.id);
  return c.json({ data: { token, userId: user.id } }, 201);
});

// Email login
authRoutes.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) {
    return c.json({ error: 'Too many login attempts. Try again later.' }, 429);
  }

  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !user.passwordHash) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await createToken(user.id);
  return c.json({ data: { token, userId: user.id } });
});

// Apple Sign-In
authRoutes.post('/apple', async (c) => {
  const body = await c.req.json();
  const parsed = appleAuthSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { appleId, email } = parsed.data;

  let [user] = await db.select().from(users).where(eq(users.appleId, appleId));

  if (!user) {
    [user] = await db
      .insert(users)
      .values({ appleId, email })
      .returning();

    // Create empty profile
    await db.insert(playerProfiles).values({ userId: user.id });
  }

  const token = await createToken(user.id);
  return c.json({ data: { token, userId: user.id } });
});

// Auth middleware
export async function authMiddleware(c: Context, next: Next): Promise<Response | void> {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { payload } = await jwtVerify(header.slice(7), JWT_SECRET);
    c.set('userId', payload.sub as string);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}
