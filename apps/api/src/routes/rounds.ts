import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db';
import { roundScores, playerProfiles, playbooks } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { authMiddleware } from './auth';
import { Anthropic } from '@anthropic-ai/sdk';
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

// GET /rounds/:id/review - Decision review and lessons
roundRoutes.get('/:id/review', async (c) => {
  const userId = c.get('userId') as string;
  const roundId = c.req.param('id');

  // Get round
  const [round] = await db
    .select()
    .from(roundScores)
    .where(eq(roundScores.id, roundId));

  if (!round) {
    return c.json({ error: 'Round not found' }, 404);
  }

  // Verify ownership
  const [profile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.id, round.profileId));

  const [userProfile] = await db
    .select()
    .from(playerProfiles)
    .where(eq(playerProfiles.userId, userId));

  if (!userProfile || profile.id !== userProfile.id) {
    return c.json({ error: 'Unauthorized' }, 403);
  }

  // If no playbook, return basic stats only
  if (!round.playbookId) {
    const holeScores = (round.holeScores as number[]) || [];
    return c.json({
      data: {
        type: 'basic',
        totalScore: round.totalScore,
        note: 'Playbook required for decision review',
      },
    });
  }

  // Get playbook
  const [playbook] = await db
    .select()
    .from(playbooks)
    .where(eq(playbooks.id, round.playbookId));

  if (!playbook) {
    return c.json({ error: 'Playbook not found' }, 404);
  }

  // Analyze decisions
  const holeScores = (round.holeScores as number[]) || [];
  const strategies = playbook.holeStrategies as any[];

  const analysis = analyzeDecisions(holeScores, strategies);

  // Generate lessons with Claude
  let lessons: string[] = [];
  try {
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = `You are a golf caddie analyzing a round. Generate 3 concise, actionable lessons from this round data:

Round Score: ${round.totalScore}
Course Par: ${strategies.reduce((sum, s) => sum + (s.par || 0), 0)}

Scoring Breakdown:
- Pars: ${analysis.pars}
- Bogeys: ${analysis.bogeys}
- Doubles+: ${analysis.doubles}
- Birdies: ${analysis.birdies}

Key Insights:
- Par conversion: ${analysis.parConversion}%
- Holes with big numbers: ${analysis.worstHoles.map(h => `#${h.hole}`).join(', ')}
- Best performing holes: ${analysis.bestHoles.map(h => `#${h.hole}`).join(', ')}

Generate exactly 3 lessons (short, punchy sentences):
1. [lesson about decision-making or course management]
2. [lesson about what went well]
3. [lesson about what to focus on next time]

Format as JSON: {"lessons": ["lesson1", "lesson2", "lesson3"]}`;

    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text);
    lessons = parsed.lessons || [];
  } catch (err) {
    console.error('Failed to generate lessons:', err);
    // Fall back to basic lessons
    lessons = [
      `Converted ${analysis.parConversion}% of pars—focus on greens in regulation.`,
      `Avoided big numbers on ${18 - analysis.doubles} holes—keep that consistency.`,
      `Next time: work on ${analysis.doubles > 3 ? 'minimizing doubles' : 'par conversion on tougher holes'}.`,
    ];
  }

  return c.json({
    data: {
      type: 'decision_review',
      totalScore: round.totalScore,
      overPar: round.totalScore - strategies.reduce((sum, s) => sum + (s.par || 0), 0),
      analysis,
      lessons,
    },
  });
});

function analyzeDecisions(holeScores: number[], strategies: any[]) {
  let pars = 0;
  let bogeys = 0;
  let doubles = 0;
  let birdies = 0;
  const scores_by_hole: any[] = [];

  for (let i = 0; i < holeScores.length; i++) {
    const score = holeScores[i];
    const par = strategies[i]?.par || 4;
    const diff = score - par;

    if (diff < 0) birdies++;
    else if (diff === 0) pars++;
    else if (diff === 1) bogeys++;
    else doubles++;

    scores_by_hole.push({ hole: i + 1, score, par, diff });
  }

  const sorted = [...scores_by_hole].sort((a, b) => b.diff - a.diff);
  const worstHoles = sorted.slice(0, 3);
  const bestHoles = sorted.slice(-3).reverse();

  return {
    pars,
    bogeys,
    doubles,
    birdies,
    parConversion: Math.round((pars / 18) * 100),
    worstHoles,
    bestHoles,
  };
}
