import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { db } from '../db';
import {
  playbooks,
  playerProfiles,
  playerClubs,
  courses,
  holes,
  courseHoleMemory,
} from '../db/schema';
import type { HoleStrategy, HoleMemoryLearning, CourseHoleMemoryRow } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';
import { CADDIE_SYSTEM_PROMPT, CADDIE_BACK9_SYSTEM_PROMPT, buildPlaybookPrompt, buildPlaybookPromptForRange, buildCustomCoursePrompt, mergeDbDataIntoHoles } from '../lib/prompts';
import { StreamingHoleParser } from '../lib/stream-parser';
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

const notesSchema = z.object({
  holeIndex: z.number().int().min(0).max(17),
  note: z.string().max(500),
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
        model: 'claude-sonnet-4-6',
        max_tokens: 8000,
        system: CADDIE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });

      const raw =
        response.content[0].type === 'text' ? response.content[0].text : '';
      const text = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(text) as PlaybookResponse;
    } catch (err) {
      console.error(`[claude] attempt ${attempt + 1} failed:`, err);
      if (attempt === 1) throw err;
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
  let profile: typeof playerProfiles.$inferSelect | undefined;
  try {
    [profile] = await db
      .select()
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, userId));
  } catch (err) {
    console.error('[playbook] DB profile query failed:', err);
    return c.json({ error: `Database error: ${String(err)}` }, 500);
  }

  if (!profile) {
    return c.json({ error: 'Profile not found. Complete onboarding first.' }, 404);
  }

  // Check cache
  let cached: typeof playbooks.$inferSelect | undefined;
  try {
    [cached] = await db
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
  } catch (err) {
    console.error('[playbook] DB cache query failed:', err);
    return c.json({ error: `Database error: ${String(err)}` }, 500);
  }

  if (cached) {
    return c.json({ data: cached });
  }

  // Fetch clubs
  let clubs: (typeof playerClubs.$inferSelect)[];
  try {
    clubs = await db
      .select()
      .from(playerClubs)
      .where(eq(playerClubs.profileId, profile.id))
      .orderBy(playerClubs.sortOrder);
  } catch (err) {
    console.error('[playbook] DB clubs query failed:', err);
    return c.json({ error: `Database error: ${String(err)}` }, 500);
  }

  // Fetch course + holes
  let course: typeof courses.$inferSelect | undefined;
  let courseHoles: (typeof holes.$inferSelect)[];
  try {
    [course] = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!course) {
      return c.json({ error: 'Course not found' }, 404);
    }
    courseHoles = await db
      .select()
      .from(holes)
      .where(eq(holes.courseId, courseId))
      .orderBy(holes.holeNumber);
  } catch (err) {
    console.error('[playbook] DB course/holes query failed:', err);
    return c.json({ error: `Database error: ${String(err)}` }, 500);
  }

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

  // Fetch prior course memory for this player + course
  let priorMemory: CourseHoleMemoryRow[] = [];
  try {
    const memoryRows = await db
      .select()
      .from(courseHoleMemory)
      .where(
        and(
          eq(courseHoleMemory.profileId, profile.id),
          eq(courseHoleMemory.courseId, courseId)
        )
      );
    priorMemory = memoryRows.map((r) => ({
      holeNumber: r.holeNumber,
      keyLearnings: (r.keyLearnings as HoleMemoryLearning[]) || [],
      numVisits: r.numVisits,
    }));
  } catch (err) {
    console.error('[playbook] Failed to fetch course memory (non-fatal):', err);
  }

  // Build prompt and call Claude
  const prompt = buildPlaybookPrompt(
    { ...profile, clubs },
    { ...course, holes: courseHoles },
    teeName,
    forecast as { temp?: number; wind_speed?: number; wind_deg?: number; weather?: Array<{ description: string }> },
    scoringGoal,
    undefined,
    priorMemory.length > 0 ? priorMemory : undefined
  );

  let playbookData: PlaybookResponse;
  try {
    playbookData = await callClaudeWithRetry(prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Claude error: ${msg}` }, 502);
  }

  // Merge DB data (hole_number, yardage, par) into Claude's lean output
  const mergedHoles = mergeDbDataIntoHoles(
    playbookData.holes as unknown as Array<Record<string, unknown>>,
    courseHoles,
    teeName
  ) as unknown as HoleStrategy[];

  // Cache in DB
  let saved: typeof playbooks.$inferSelect;
  try {
    [saved] = await db
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
        holeStrategies: mergedHoles,
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
          holeStrategies: mergedHoles,
          projectedScore: playbookData.projected_score,
          driverHoles: playbookData.driver_holes,
          parChanceHoles: playbookData.par_chance_holes,
          generatedAt: new Date(),
        },
      })
      .returning();
  } catch (err) {
    console.error('[playbook] DB insert failed:', err);
    return c.json({ error: `Database error saving playbook: ${String(err)}` }, 500);
  }

  return c.json({ data: saved }, 201);
});

// POST /playbook/generate-stream — SSE streaming endpoint
playbookRoutes.post('/generate-stream', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const parsed = generateSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { courseId, teeName, roundDate, teeTime, scoringGoal } = parsed.data;

  // Get profile first (needed for cache check)
  let profile: typeof playerProfiles.$inferSelect | undefined;
  try {
    [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId));
  } catch (err) {
    return c.json({ error: `Database error: ${String(err)}` }, 500);
  }
  if (!profile) {
    return c.json({ error: 'Profile not found. Complete onboarding first.' }, 404);
  }

  // Check cache
  let cached: typeof playbooks.$inferSelect | undefined;
  try {
    [cached] = await db.select().from(playbooks).where(
      and(
        eq(playbooks.profileId, profile.id),
        eq(playbooks.courseId, courseId),
        eq(playbooks.teeName, teeName),
        eq(playbooks.roundDate, roundDate)
      )
    );
  } catch (err) {
    return c.json({ error: `Database error: ${String(err)}` }, 500);
  }

  if (cached) {
    // Cache hit: return complete playbook via SSE
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'complete', data: JSON.stringify(cached) });
    });
  }

  // Fetch clubs, course+holes, weather, and course memory in parallel
  const [clubsResult, courseResult, holesResult, forecast, memoryRows] = await Promise.all([
    db.select().from(playerClubs).where(eq(playerClubs.profileId, profile.id)).orderBy(playerClubs.sortOrder),
    db.select().from(courses).where(eq(courses.id, courseId)),
    db.select().from(holes).where(eq(holes.courseId, courseId)).orderBy(holes.holeNumber),
    fetchWeather(courseId, teeTime),
    db.select().from(courseHoleMemory).where(
      and(
        eq(courseHoleMemory.profileId, profile.id),
        eq(courseHoleMemory.courseId, courseId)
      )
    ).catch((err) => {
      console.error('[playbook-stream] Failed to fetch course memory (non-fatal):', err);
      return [];
    }),
  ]);

  const course = courseResult[0];
  if (!course) {
    return c.json({ error: 'Course not found' }, 404);
  }

  const priorMemory: CourseHoleMemoryRow[] = memoryRows.map((r) => ({
    holeNumber: r.holeNumber,
    keyLearnings: (r.keyLearnings as HoleMemoryLearning[]) || [],
    numVisits: r.numVisits,
  }));

  const weatherData = forecast as { temp?: number; wind_speed?: number; wind_deg?: number; weather?: Array<{ description: string }> };
  const profileWithClubs = { ...profile, clubs: clubsResult };
  const courseWithHoles = { ...course, holes: holesResult };
  const memoryArg = priorMemory.length > 0 ? priorMemory : undefined;

  // Build prompts for front 9 (with meta) and back 9 (holes only)
  const front9Prompt = buildPlaybookPromptForRange(
    profileWithClubs, courseWithHoles, teeName, weatherData, scoringGoal, 1, 9, undefined, memoryArg
  );
  const back9Prompt = buildPlaybookPromptForRange(
    profileWithClubs, courseWithHoles, teeName, weatherData, scoringGoal, 10, 18, undefined, memoryArg
  );

  // Set SSE headers
  c.header('Cache-Control', 'no-cache');
  c.header('X-Accel-Buffering', 'no');

  return streamSSE(c, async (stream) => {
    try {
      const sortedDbHoles = [...holesResult].sort((a, b) => a.holeNumber - b.holeNumber);
      const front9DbHoles = sortedDbHoles.filter((h) => h.holeNumber <= 9);
      const back9DbHoles = sortedDbHoles.filter((h) => h.holeNumber > 9);

      // Parsers for each stream
      const front9Parser = new StreamingHoleParser();
      const back9Parser = new StreamingHoleParser();
      let front9HoleIdx = 0;
      let back9HoleIdx = 0;

      // Collected data for DB storage
      const allLeanHoles: Array<Record<string, unknown>> = new Array(18);
      let metaData: { pre_round_talk: string; projected_score: number; driver_holes: number[]; par_chance_holes: number[] } | null = null;

      // Process front 9 stream — emits meta + holes 1-9
      async function processFront9() {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 5000,
          system: CADDIE_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: front9Prompt }],
        });

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const { meta, holes: newHoles } = front9Parser.onDelta(event.delta.text);

            if (meta) {
              metaData = meta;
              await stream.writeSSE({ event: 'meta', data: JSON.stringify(meta) });
            }

            for (const leanHole of newHoles) {
              const dbHole = front9DbHoles[front9HoleIdx];
              if (dbHole) {
                const merged = {
                  hole_number: dbHole.holeNumber,
                  yardage: (dbHole.yardages as Record<string, number>)[teeName],
                  par: dbHole.par,
                  ...leanHole,
                };
                await stream.writeSSE({ event: 'hole', data: JSON.stringify(merged) });
                allLeanHoles[dbHole.holeNumber - 1] = leanHole;
              }
              front9HoleIdx++;
            }
          }
        }
      }

      // Process back 9 stream — emits holes 10-18 only
      // Buffers holes and emits them after front 9 holes are done
      const back9Buffer: Array<{ merged: Record<string, unknown>; lean: Record<string, unknown>; holeNum: number }> = [];

      async function processBack9() {
        const claudeStream = anthropic.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 4000,
          system: CADDIE_BACK9_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: back9Prompt }],
        });

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const { holes: newHoles } = back9Parser.onDelta(event.delta.text);

            for (const leanHole of newHoles) {
              const dbHole = back9DbHoles[back9HoleIdx];
              if (dbHole) {
                const merged = {
                  hole_number: dbHole.holeNumber,
                  yardage: (dbHole.yardages as Record<string, number>)[teeName],
                  par: dbHole.par,
                  ...leanHole,
                };
                back9Buffer.push({ merged, lean: leanHole, holeNum: dbHole.holeNumber });
              }
              back9HoleIdx++;
            }
          }
        }
      }

      // Fire both in parallel
      await Promise.all([processFront9(), processBack9()]);

      // Emit buffered back 9 holes in order
      back9Buffer.sort((a, b) => a.holeNum - b.holeNum);
      for (const { merged, lean, holeNum } of back9Buffer) {
        await stream.writeSSE({ event: 'hole', data: JSON.stringify(merged) });
        allLeanHoles[holeNum - 1] = lean;
      }

      // Build complete hole strategies for DB
      const mergedHoles = allLeanHoles.map((lean, i) => {
        const dbHole = sortedDbHoles[i];
        return {
          hole_number: dbHole.holeNumber,
          yardage: (dbHole.yardages as Record<string, number>)[teeName],
          par: dbHole.par,
          ...(lean || {}),
        };
      }) as unknown as HoleStrategy[];

      // Save to DB
      const [saved] = await db.insert(playbooks).values({
        profileId: profile.id,
        courseId,
        teeName,
        scoringGoal,
        roundDate,
        teeTime,
        weatherConditions: forecast,
        preRoundTalk: metaData?.pre_round_talk || '',
        holeStrategies: mergedHoles,
        projectedScore: metaData?.projected_score || 0,
        driverHoles: metaData?.driver_holes || [],
        parChanceHoles: metaData?.par_chance_holes || [],
      }).onConflictDoUpdate({
        target: [playbooks.profileId, playbooks.courseId, playbooks.teeName, playbooks.roundDate],
        set: {
          weatherConditions: forecast,
          preRoundTalk: metaData?.pre_round_talk || '',
          holeStrategies: mergedHoles,
          projectedScore: metaData?.projected_score || 0,
          driverHoles: metaData?.driver_holes || [],
          parChanceHoles: metaData?.par_chance_holes || [],
          generatedAt: new Date(),
        },
      }).returning();

      await stream.writeSSE({ event: 'done', data: JSON.stringify({ id: saved.id }) });
    } catch (err) {
      console.error('[playbook-stream] generation failed:', err);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: err instanceof Error ? err.message : 'Generation failed' }),
      });
    }
  });
});

// Helper: fetch weather for a course
async function fetchWeather(courseId: string, teeTime: string): Promise<Record<string, unknown>> {
  try {
    const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
    if (!course?.latitude || !course?.longitude) return {};

    const weatherRes = await fetch(
      `https://api.openweathermap.org/data/3.0/onecall?` +
        `lat=${course.latitude}&lon=${course.longitude}` +
        `&exclude=minutely,alerts&units=imperial` +
        `&appid=${process.env.OPENWEATHER_KEY}`
    );

    if (weatherRes.ok) {
      const weather = await weatherRes.json();
      const teeHour = parseInt(teeTime.split(':')[0]);
      return weather.hourly?.find(
        (h: { dt: number }) => new Date(h.dt * 1000).getHours() === teeHour
      ) || weather.current || {};
    }
  } catch {
    // Weather fetch failed — proceed without it
  }
  return {};
}

// ============ COURSE MEMORY ENDPOINTS ============

const saveLearningSchema = z.object({
  learning: z.string().min(1).max(500),
  confidence: z.enum(['high', 'medium', 'low']),
});

// POST /playbook/courses/:courseId/hole/:holeNumber/learning
playbookRoutes.post('/courses/:courseId/hole/:holeNumber/learning', async (c) => {
  const userId = c.get('userId') as string;
  const courseId = c.req.param('courseId');
  const holeNumber = parseInt(c.req.param('holeNumber'), 10);

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(courseId).success) {
    return c.json({ error: 'Invalid courseId' }, 400);
  }
  if (isNaN(holeNumber) || holeNumber < 1 || holeNumber > 18) {
    return c.json({ error: 'holeNumber must be 1-18' }, 400);
  }

  const body = await c.req.json();
  const parsed = saveLearningSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { learning, confidence } = parsed.data;

  // Get profile
  const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId));
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  // Verify course exists
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) return c.json({ error: 'Course not found' }, 404);

  // Fetch existing memory row
  const [existing] = await db
    .select()
    .from(courseHoleMemory)
    .where(
      and(
        eq(courseHoleMemory.profileId, profile.id),
        eq(courseHoleMemory.courseId, courseId),
        eq(courseHoleMemory.holeNumber, holeNumber)
      )
    );

  const now = new Date().toISOString();
  const newLearning: HoleMemoryLearning = {
    note: `[${confidence}] ${learning}`,
    visitCount: 1,
    lastUpdated: now,
  };

  if (existing) {
    // Merge: add new learning, increment numVisits
    const currentLearnings = (existing.keyLearnings as HoleMemoryLearning[]) || [];
    const updatedLearnings = [...currentLearnings, newLearning];

    const [updated] = await db
      .update(courseHoleMemory)
      .set({
        keyLearnings: updatedLearnings,
        numVisits: existing.numVisits + 1,
        updatedAt: new Date(),
      })
      .where(eq(courseHoleMemory.id, existing.id))
      .returning();

    return c.json({ data: updated });
  } else {
    // Insert new row
    const [inserted] = await db
      .insert(courseHoleMemory)
      .values({
        courseId,
        profileId: profile.id,
        holeNumber,
        keyLearnings: [newLearning],
        numVisits: 1,
      })
      .returning();

    return c.json({ data: inserted }, 201);
  }
});

// GET /playbook/courses/:courseId/memory
playbookRoutes.get('/courses/:courseId/memory', async (c) => {
  const userId = c.get('userId') as string;
  const courseId = c.req.param('courseId');

  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(courseId).success) {
    return c.json({ error: 'Invalid courseId' }, 400);
  }

  const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId));
  if (!profile) return c.json({ error: 'Profile not found' }, 404);

  const memoryRows = await db
    .select()
    .from(courseHoleMemory)
    .where(
      and(
        eq(courseHoleMemory.profileId, profile.id),
        eq(courseHoleMemory.courseId, courseId)
      )
    )
    .orderBy(courseHoleMemory.holeNumber);

  const memories: CourseHoleMemoryRow[] = memoryRows.map((r) => ({
    holeNumber: r.holeNumber,
    keyLearnings: (r.keyLearnings as HoleMemoryLearning[]) || [],
    numVisits: r.numVisits,
  }));

  return c.json({ data: { courseId, memories } });
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

// GET /playbook/:id/yardage-book
playbookRoutes.get('/:id/yardage-book', async (c) => {
  const id = c.req.param('id');
  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: 'Invalid playbook ID' }, 400);
  }

  const userId = c.get('userId') as string;

  // Fetch playbook
  const [playbook] = await db.select().from(playbooks).where(eq(playbooks.id, id));
  if (!playbook) return c.json({ error: 'Playbook not found' }, 404);

  // Fetch profile + clubs
  const [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId));
  if (!profile) return c.json({ error: 'Profile not found' }, 404);
  const clubs = await db.select().from(playerClubs).where(eq(playerClubs.profileId, profile.id)).orderBy(playerClubs.sortOrder);

  // Fetch course (may be null for custom courses)
  let courseInfo: { name: string; par: number } = { name: 'Custom Course', par: 72 };
  if (playbook.courseId) {
    const [course] = await db.select().from(courses).where(eq(courses.id, playbook.courseId));
    if (course) courseInfo = { name: course.name, par: course.par };
  }

  const { generateYardageBookHtml } = await import('../lib/yardage-book');
  const html = generateYardageBookHtml(
    playbook as Parameters<typeof generateYardageBookHtml>[0],
    profile as Parameters<typeof generateYardageBookHtml>[1],
    clubs as Parameters<typeof generateYardageBookHtml>[2],
    courseInfo
  );

  return c.json({ data: { html } });
});

// PATCH /playbook/:id/notes
playbookRoutes.patch('/:id/notes', async (c) => {
  const id = c.req.param('id');
  const uuidSchema = z.string().uuid();
  if (!uuidSchema.safeParse(id).success) {
    return c.json({ error: 'Invalid playbook ID' }, 400);
  }

  const body = await c.req.json();
  const parsed = notesSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const { holeIndex, note } = parsed.data;

  // Fetch current caddieNotes
  const [playbook] = await db.select().from(playbooks).where(eq(playbooks.id, id));
  if (!playbook) return c.json({ error: 'Playbook not found' }, 404);

  const notes: string[] = Array.isArray(playbook.caddieNotes)
    ? [...(playbook.caddieNotes as string[])]
    : Array(18).fill('');
  notes[holeIndex] = note;

  await db.update(playbooks)
    .set({ caddieNotes: notes })
    .where(eq(playbooks.id, id));

  return c.json({ data: { ok: true } });
});

// POST /playbook/generate-from-description
const generateFromDescriptionSchema = z.object({
  courseName: z.string().min(1).max(200),
  teeName: z.string().min(1).max(50),
  courseDescription: z.string().min(1).max(10000),
  roundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teeTime: z.string().regex(/^\d{2}:\d{2}$/),
  scoringGoal: z.string().min(1).max(200),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
});

playbookRoutes.post('/generate-from-description', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json();
  const parsed = generateFromDescriptionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      400
    );
  }

  const { courseName, teeName, courseDescription, roundDate, teeTime, scoringGoal, city, state } = parsed.data;

  // Get player profile + clubs
  const [profile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId));

  if (!profile) {
    return c.json({ error: 'Profile not found. Complete onboarding first.' }, 404);
  }

  const clubs = await db
    .select()
    .from(playerClubs)
    .where(eq(playerClubs.profileId, profile.id))
    .orderBy(playerClubs.sortOrder);

  // Fetch weather by geocoding city/state (best-effort, non-fatal)
  let forecast: Record<string, unknown> = {};
  if (city && process.env.OPENWEATHER_KEY) {
    try {
      const geoRes = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city + (state ? ',' + state : '') + ',US')}&limit=1&appid=${process.env.OPENWEATHER_KEY}`
      );
      if (geoRes.ok) {
        const geoData = await geoRes.json() as Array<{ lat: number; lon: number }>;
        if (geoData[0]) {
          const { lat, lon } = geoData[0];
          const weatherRes = await fetch(
            `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,alerts&units=imperial&appid=${process.env.OPENWEATHER_KEY}`
          );
          if (weatherRes.ok) {
            const weather = await weatherRes.json();
            const teeHour = parseInt(teeTime.split(':')[0]);
            forecast =
              weather.hourly?.find(
                (h: { dt: number }) => new Date(h.dt * 1000).getHours() === teeHour
              ) || weather.current || {};
          }
        }
      }
    } catch {
      // Weather fetch failed — proceed without it
    }
  }

  // Build prompt and call Claude
  const prompt = buildCustomCoursePrompt(
    { ...profile, clubs },
    courseName,
    teeName,
    forecast as { temp?: number; wind_speed?: number; wind_deg?: number; weather?: Array<{ description: string }> },
    scoringGoal,
    courseDescription
  );

  let playbookData: PlaybookResponse;
  try {
    playbookData = await callClaudeWithRetry(prompt);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Claude error: ${msg}` }, 502);
  }

  // Save to DB (courseId = null — no caching for custom courses)
  const [saved] = await db
    .insert(playbooks)
    .values({
      profileId: profile.id,
      courseId: null,
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
    .returning();

  return c.json({ data: saved }, 201);
});
