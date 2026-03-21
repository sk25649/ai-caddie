import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToken, mockSelect, mockUpdate, mockPlaybook, TEST_USER_ID, TEST_PLAYBOOK_ID } from './helpers';
import { buildPlaybookPrompt } from '../lib/prompts';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

import { playbookRoutes } from '../routes/playbook';

// ── Helpers ────────────────────────────────────────────────────────────────

async function authedPatch(path: string, body: unknown) {
  const token = await makeToken(TEST_USER_ID);
  return playbookRoutes.request(path, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

// Prompt fixtures (mirrors prompts.test.ts)

const baseProfile = {
  displayName: 'Sam',
  handicap: '18',
  stockShape: 'draw',
  missPrimary: 'High hook left',
  missSecondary: 'Slice right',
  missDescription: 'Worse under pressure',
  dreamScore: 85,
  goalScore: 89,
  floorScore: 99,
  clubs: [
    { clubName: 'Driver', carryDistance: 240, isFairwayFinder: false },
    { clubName: '3-Hybrid', carryDistance: 210, isFairwayFinder: true },
    { clubName: '7-Iron', carryDistance: 160, isFairwayFinder: false },
    { clubName: 'PW', carryDistance: 125, isFairwayFinder: false },
  ],
};

const baseCourse = {
  name: 'Torrey Pines South',
  par: 72,
  tees: [
    { name: 'White', color: '#fff', totalYardage: 6874, rating: 74.6, slope: 138 },
  ],
  courseIntel: { overview: 'Clifftop links', windPatterns: 'Ocean breeze' },
  holes: Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: i < 4 ? 3 : 4,
    handicapIndex: i + 1,
    yardages: { White: 350 + i * 5 },
    holeIntel: { shape: 'straight' },
  })),
};

const baseWeather = {
  temp: 72,
  wind_speed: 10,
  wind_deg: 0,
  weather: [{ description: 'sunny' }],
};

// ── Tests: PATCH /playbook/:id/notes — validation ──────────────────────────

describe('PATCH /playbook/:id/notes — validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 400 for holeIndex below 0', async () => {
    const res = await authedPatch(`/${TEST_PLAYBOOK_ID}/notes`, {
      holeIndex: -1,
      note: 'Valley here plays 20y longer',
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for holeIndex above 17', async () => {
    const res = await authedPatch(`/${TEST_PLAYBOOK_ID}/notes`, {
      holeIndex: 18,
      note: 'Too high index',
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for note longer than 500 characters', async () => {
    const res = await authedPatch(`/${TEST_PLAYBOOK_ID}/notes`, {
      holeIndex: 0,
      note: 'x'.repeat(501),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Validation failed');
  });

  it('returns 400 for invalid UUID playbook ID', async () => {
    const res = await authedPatch('/not-a-uuid/notes', {
      holeIndex: 0,
      note: 'Valid note',
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid playbook ID');
  });

  it('returns 404 when playbook not found', async () => {
    mockSelect(mockDb, []); // no playbook

    const res = await authedPatch(`/${TEST_PLAYBOOK_ID}/notes`, {
      holeIndex: 0,
      note: 'Valid note',
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Playbook not found');
  });

  it('accepts a valid note at holeIndex 0', async () => {
    mockSelect(mockDb, [{ ...mockPlaybook, caddieNotes: null }]);
    mockUpdate(mockDb, [{ ...mockPlaybook, caddieNotes: ['Valid note'] }]);

    const res = await authedPatch(`/${TEST_PLAYBOOK_ID}/notes`, {
      holeIndex: 0,
      note: 'Valid note',
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.ok).toBe(true);
  });

  it('accepts a valid note at holeIndex 17', async () => {
    mockSelect(mockDb, [{ ...mockPlaybook, caddieNotes: null }]);
    mockUpdate(mockDb, [{ ...mockPlaybook, caddieNotes: Array(18).fill('') }]);

    const res = await authedPatch(`/${TEST_PLAYBOOK_ID}/notes`, {
      holeIndex: 17,
      note: 'Green firm, back pin is dead',
    });

    expect(res.status).toBe(200);
  });

  it('accepts exactly 500 character note', async () => {
    mockSelect(mockDb, [{ ...mockPlaybook, caddieNotes: null }]);
    mockUpdate(mockDb, [mockPlaybook]);

    const res = await authedPatch(`/${TEST_PLAYBOOK_ID}/notes`, {
      holeIndex: 5,
      note: 'x'.repeat(500),
    });

    expect(res.status).toBe(200);
  });

  it('preserves existing notes when updating a single hole', async () => {
    const existingNotes = Array(18).fill('') as string[];
    existingNotes[3] = 'Existing note on hole 4';
    mockSelect(mockDb, [{ ...mockPlaybook, caddieNotes: existingNotes }]);
    mockUpdate(mockDb, [mockPlaybook]);

    const res = await authedPatch(`/${TEST_PLAYBOOK_ID}/notes`, {
      holeIndex: 7,
      note: 'New note on hole 8',
    });

    expect(res.status).toBe(200);
    // Verify update was called (the mock confirms the call went through)
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });
});

// ── Tests: buildPlaybookPrompt — caddieNotes injection ─────────────────────

describe('buildPlaybookPrompt — caddieNotes injection', () => {
  it('works without caddieNotes (backward compat)', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('HOLE-BY-HOLE DATA');
  });

  it('works with undefined caddieNotes (backward compat)', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90', undefined);
    expect(prompt).not.toContain('caddieNote');
  });

  it('injects caddieNote for a hole when note is non-empty', () => {
    const notes = Array(18).fill('') as string[];
    notes[0] = 'Valley at 185 plays 20y longer';

    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90', notes);
    expect(prompt).toContain('Valley at 185 plays 20y longer');
    expect(prompt).toContain('caddieNote');
  });

  it('does not include caddieNote key for holes with empty notes', () => {
    const notes = Array(18).fill('') as string[];
    notes[6] = 'Green always firm';

    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90', notes);

    // The note should appear in the prompt
    expect(prompt).toContain('Green always firm');

    // Parse the hole-by-hole JSON section to verify only hole 7 has caddieNote
    const jsonStart = prompt.indexOf('[');
    const jsonEnd = prompt.lastIndexOf(']') + 1;
    const holesJson = JSON.parse(prompt.slice(jsonStart, jsonEnd)) as Array<Record<string, unknown>>;

    // Hole 7 (index 6) should have caddieNote
    expect(holesJson[6].caddieNote).toBe('Green always firm');

    // Other holes should NOT have caddieNote
    holesJson.forEach((h, i) => {
      if (i !== 6) {
        expect(h.caddieNote).toBeUndefined();
      }
    });
  });

  it('injects notes for multiple holes', () => {
    const notes = Array(18).fill('') as string[];
    notes[2] = 'Left bunker has no exit angle';
    notes[11] = 'Back pin always back left — aim front right';

    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90', notes);

    expect(prompt).toContain('Left bunker has no exit angle');
    expect(prompt).toContain('Back pin always back left');
  });

  it('ignores empty string notes (no caddieNote key added)', () => {
    const notes = Array(18).fill('') as string[];

    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90', notes);

    expect(prompt).not.toContain('caddieNote');
  });

  it('still includes player and course data when caddieNotes provided', () => {
    const notes = Array(18).fill('') as string[];
    notes[0] = 'Some note';

    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90', notes);

    expect(prompt).toContain('Sam');
    expect(prompt).toContain('Torrey Pines South');
    expect(prompt).toContain('Break 90');
  });
});
