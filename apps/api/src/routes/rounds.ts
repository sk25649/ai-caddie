import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { roundScores, playerProfiles } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from './auth';
import type { AppEnv } from '../lib/types';

export const roundRoutes = new Hono<AppEnv>();
roundRoutes.use('*', authMiddleware);

const createRoundSchema = z.object({
  playbookId: z.string().uuid().optional(),
  courseId: z.string().uuid(),
  roundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teeName: z.string().min(1),
  holeScores: z.array(z.number().int().min(1).max(15)).length(18),
  totalScore: z.number().int().min(18).max(270),
  notes: z.string().max(1000).optional(),
});

// POST /rounds
roundRoutes.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const parsed = createRoundSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const [profile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId));

  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }

  // Verify totalScore matches sum of hole scores
  const sum = parsed.data.holeScores.reduce((a, b) => a + b, 0);
  if (sum !== parsed.data.totalScore) {
    return c.json(
      { error: `Total score (${parsed.data.totalScore}) doesn't match hole scores sum (${sum})` },
      400
    );
  }

  const [round] = await db
    .insert(roundScores)
    .values({
      profileId: profile.id,
      ...parsed.data,
    })
    .returning();

  return c.json({ data: round }, 201);
});

// GET /rounds
roundRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;

  const [profile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId));

  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }

  const rounds = await db
    .select()
    .from(roundScores)
    .where(eq(roundScores.profileId, profile.id))
    .orderBy(desc(roundScores.roundDate));

  return c.json({ data: rounds });
});
