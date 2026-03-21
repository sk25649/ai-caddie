import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import {
  playbooks,
  playerProfiles,
  playerClubs,
  courses,
  holes,
} from '../db/schema';
import type { HoleStrategy } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { CADDIE_SYSTEM_PROMPT, buildPlaybookPrompt } from '../lib/prompts';
import { authMiddleware } from './auth';
import type { AppEnv } from '../lib/types';

export const playbookRoutes = new Hono<AppEnv>();
playbookRoutes.use('*', authMiddleware);

const anthropic = new Anthropic();

const generateSchema = z.object({
  courseId: z.string().uuid(),
  teeName: z.string().min(1),
  roundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teeTime: z.string().regex(/^\d{2}:\d{2}$/),
  scoringGoal: z.string().min(1).max(200),
});

interface PlaybookResponse {
  pre_round_talk: string;
  projected_score: number;
  driver_holes: number[];
  par_chance_holes: number[];
  holes: HoleStrategy[];
}

async function callClaudeWithRetry(prompt: string): Promise<PlaybookResponse> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: CADDIE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(text) as PlaybookResponse;
    } catch (err) {
      if (attempt === 1) throw err;
      // Retry once on parse/API error
    }
  }
  throw new Error('Failed to generate playbook after retries');
}

// POST /playbook/generate
playbookRoutes.post('/generate', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400
    );
  }

  const { courseId, teeName, roundDate, teeTime, scoringGoal } = parsed.data;

  // Get player profile
  const [profile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId));

  if (!profile) {
    return c.json({ error: 'Profile not found. Complete onboarding first.' }, 404);
  }

  // Check cache
  const [cached] = await db
    .select()
    .from(playbooks)
    .where(
      and(
        eq(playbooks.profileId, profile.id),
        eq(playbooks.courseId, courseId),
        eq(playbooks.teeName, teeName),
        eq(playbooks.roundDate, roundDate)
      )
    );

  if (cached) {
    return c.json({ data: cached });
  }

  // Fetch clubs
  const clubs = await db
    .select()
    .from(playerClubs)
    .where(eq(playerClubs.profileId, profile.id))
    .orderBy(playerClubs.sortOrder);

  // Fetch course + holes
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  const courseHoles = await db
    .select()
    .from(holes)
    .where(eq(holes.courseId, courseId))
    .orderBy(holes.holeNumber);

  // Fetch weather
  let forecast: Record<string, unknown> = {};
  try {
    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?` +
        `lat=${course.latitude}&lon=${course.longitude}` +
        `&exclude=minutely,alerts&units=imperial` +
        `&appid=${process.env.OPENWEATHER_KEY}`
    );

    if (weatherRes.ok) {
      const weather = await weatherRes.json();
      const teeHour = parseInt(teeTime.split(':')[0]);
      forecast =
        weather.hourly?.find(
          (h: { dt: number }) => new Date(h.dt * 1000).getHours() === teeHour
        ) || weather.current || {};
    }
  } catch {
    // Weather fetch failed — proceed without it
  }

  // Build prompt and call Claude
  const prompt = buildPlaybookPrompt(
    { ...profile, clubs },
    { ...course, holes: courseHoles },
    teeName,
    forecast as { temp?: number; wind_speed?: number; wind_deg?: number; weather?: Array<{ description: string }> },
    scoringGoal
  );

  let playbookData: PlaybookResponse;
  try {
    playbookData = await callClaudeWithRetry(prompt);
  } catch (err) {
    return c.json(
      { error: 'Failed to generate playbook. Please try again.' },
      502
    );
  }

  // Cache in DB
  const [saved] = await db
    .insert(playbooks)
    .values({
      profileId: profile.id,
      courseId,
      teeName,
      scoringGoal,
      roundDate,
      teeTime,
      weatherConditions: forecast,
      preRoundTalk: playbookData.pre_round_talk,
      holeStrategies: playbookData.holes,
      projectedScore: playbookData.projected_score,
      driverHoles: playbookData.driver_holes,
      parChanceHoles: playbookData.par_chance_holes,
    })
    .onConflictDoUpdate({
      target: [
        playbooks.profileId,
        playbooks.courseId,
        playbooks.teeName,
        playbooks.roundDate,
      ],
      set: {
        weatherConditions: forecast,
        preRoundTalk: playbookData.pre_round_talk,
        holeStrategies: playbookData.holes,
        projectedScore: playbookData.projected_score,
        driverHoles: playbookData.driver_holes,
        parChanceHoles: playbookData.par_chance_holes,
        generatedAt: new Date(),
      },
    })
    .returning();

  return c.json({ data: saved }, 201);
});

// GET /playbook/:id
playbookRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: 'Invalid playbook ID' }, 400);
  }

  const [playbook] = await db
    .select()
    .from(playbooks)
    .where(eq(playbooks.id, id));

  if (!playbook) {
    return c.json({ error: 'Playbook not found' }, 404);
  }

  return c.json({ data: playbook });
});
