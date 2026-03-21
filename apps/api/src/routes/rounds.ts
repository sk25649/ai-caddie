import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { roundScores, playerProfiles, playbooks } from '../db/schema';
import type { HoleStrategy } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from './auth';
import Anthropic from '@anthropic-ai/sdk';
import type { AppEnv } from '../lib/types';

const anthropic = new Anthropic();

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

// GET /rounds/:id/review - Decision review and lessons
roundRoutes.get('/:id/review', async (c) => {
  const userId = c.get('userId') as string;
  const roundId = c.req.param('id');

  // Get round + verify ownership via profile
  let round: typeof roundScores.$inferSelect | undefined;
  let profile: typeof playerProfiles.$inferSelect | undefined;
  try {
    [round] = await db.select().from(roundScores).where(eq(roundScores.id, roundId));
    if (!round) return c.json({ error: 'Round not found' }, 404);

    [profile] = await db.select().from(playerProfiles).where(eq(playerProfiles.userId, userId));
    if (!profile || profile.id !== round.profileId) {
      return c.json({ error: 'Unauthorized' }, 403);
    }
  } catch (err) {
    return c.json({ error: `Database error: ${String(err)}` }, 500);
  }

  // If no playbook, return basic stats only
  if (!round.playbookId) {
    return c.json({
      data: {
        type: 'basic',
        totalScore: round.totalScore,
        note: 'Playbook required for decision review',
      },
    });
  }

  // Get playbook
  let playbook: typeof playbooks.$inferSelect | undefined;
  try {
    [playbook] = await db.select().from(playbooks).where(eq(playbooks.id, round.playbookId));
  } catch (err) {
    return c.json({ error: `Database error: ${String(err)}` }, 500);
  }
  if (!playbook) return c.json({ error: 'Playbook not found' }, 404);

  const holeScores = (round.holeScores as number[]) || [];
  const strategies = playbook.holeStrategies as HoleStrategy[];
  const analysis = analyzeDecisions(holeScores, strategies);

  // Generate lessons with Claude
  let lessons: string[] = [];
  try {
    const coursePar = strategies.reduce((sum, s) => sum + (s.par || 0), 0);
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are a golf caddie analyzing a round. Generate 3 concise, actionable lessons.

Round Score: ${round.totalScore} | Course Par: ${coursePar}
Pars: ${analysis.pars} | Bogeys: ${analysis.bogeys} | Doubles+: ${analysis.doubles} | Birdies: ${analysis.birdies}
Par conversion: ${analysis.parConversion}%
Worst holes: ${analysis.worstHoles.map(h => `#${h.hole} (+${h.diff})`).join(', ')}
Best holes: ${analysis.bestHoles.map(h => `#${h.hole} (${h.diff >= 0 ? '+' : ''}${h.diff})`).join(', ')}

Return ONLY valid JSON: {"lessons": ["lesson1", "lesson2", "lesson3"]}`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    lessons = JSON.parse(cleaned).lessons || [];
  } catch (err) {
    console.error('[review] Failed to generate lessons:', err);
    lessons = [
      `Converted ${analysis.parConversion}% of pars — focus on greens in regulation.`,
      `Avoided big numbers on ${holeScores.length - analysis.doubles} holes — keep that consistency.`,
      `Next time: work on ${analysis.doubles > 3 ? 'minimizing doubles' : 'par conversion on tougher holes'}.`,
    ];
  }

  const coursePar = strategies.reduce((sum, s) => sum + (s.par || 0), 0);
  return c.json({
    data: {
      type: 'decision_review',
      totalScore: round.totalScore,
      overPar: (round.totalScore || 0) - coursePar,
      analysis,
      lessons,
    },
  });
});

function analyzeDecisions(holeScores: number[], strategies: HoleStrategy[]) {
  let pars = 0;
  let bogeys = 0;
  let doubles = 0;
  let birdies = 0;
  const scoresByHole: Array<{ hole: number; score: number; par: number; diff: number }> = [];

  for (let i = 0; i < holeScores.length; i++) {
    const score = holeScores[i];
    const par = strategies[i]?.par || 4;
    const diff = score - par;

    if (diff < 0) birdies++;
    else if (diff === 0) pars++;
    else if (diff === 1) bogeys++;
    else doubles++;

    scoresByHole.push({ hole: i + 1, score, par, diff });
  }

  const sorted = [...scoresByHole].sort((a, b) => b.diff - a.diff);

  return {
    pars,
    bogeys,
    doubles,
    birdies,
    parConversion: Math.round((pars / (holeScores.length || 1)) * 100),
    worstHoles: sorted.slice(0, 3),
    bestHoles: sorted.slice(-3).reverse(),
  };
}
