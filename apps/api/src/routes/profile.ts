import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { playerProfiles, playerClubs } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authMiddleware } from './auth';
import type { AppEnv } from '../lib/types';

export const profileRoutes = new Hono<AppEnv>();
profileRoutes.use('*', authMiddleware);

const updateProfileSchema = z.object({
  displayName: z.string().max(100).optional(),
  handicap: z.string().optional(),
  stockShape: z.enum(['draw', 'fade', 'straight']).optional(),
  missPrimary: z.string().max(200).optional(),
  missSecondary: z.string().max(200).optional(),
  missDescription: z.string().max(500).optional(),
  dreamScore: z.number().int().min(50).max(150).optional(),
  goalScore: z.number().int().min(50).max(150).optional(),
  floorScore: z.number().int().min(50).max(150).optional(),
});

const clubSchema = z.object({
  clubName: z.string().min(1).max(50),
  clubType: z.enum(['driver', 'wood', 'hybrid', 'iron', 'wedge', 'putter']),
  carryDistance: z.number().int().min(0).max(400).optional(),
  totalDistance: z.number().int().min(0).max(450).optional(),
  isFairwayFinder: z.boolean().optional(),
  notes: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateClubsSchema = z.object({
  clubs: z.array(clubSchema).min(1).max(20),
});

// GET /profile
profileRoutes.get('/', async (c) => {
  const userId = c.get('userId') as string;

  const [profile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId));

  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404);
  }

  const clubs = await db
    .select()
    .from(playerClubs)
    .where(eq(playerClubs.profileId, profile.id))
    .orderBy(playerClubs.sortOrder);

  return c.json({ data: { ...profile, clubs } });
});

// PUT /profile
profileRoutes.put('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const parsed = updateProfileSchema.safeParse(body);

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

  const [updated] = await db
    .update(playerProfiles)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(playerProfiles.userId, userId))
    .returning();

  return c.json({ data: updated });
});

// PUT /profile/clubs — replaces all clubs
profileRoutes.put('/clubs', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const parsed = updateClubsSchema.safeParse(body);

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

  // Delete existing clubs and insert new ones
  await db.delete(playerClubs).where(eq(playerClubs.profileId, profile.id));

  const clubsToInsert = parsed.data.clubs.map((club, index) => ({
    profileId: profile.id,
    ...club,
    sortOrder: club.sortOrder ?? index,
  }));

  const inserted = await db.insert(playerClubs).values(clubsToInsert).returning();

  return c.json({ data: inserted });
});
