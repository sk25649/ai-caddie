import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToken, mockSelect, mockInsert, mockProfile, TEST_USER_ID, TEST_PROFILE_ID, TEST_COURSE_ID, TEST_PLAYBOOK_ID } from './helpers';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));

import { roundRoutes } from '../routes/rounds';

// ── Helpers ────────────────────────────────────────────────────────────────

const HOLE_SCORES_72 = Array(18).fill(4); // 18 × 4 = 72
const HOLE_SCORES_89 = [5,5,5,5,5,5,5,5,5, 4,5,5,5,5,5,5,5,5]; // 81+8? let me recalc
// 9×5 = 45, 9×5 = 45... let me do 8 bogeys (5s) + 10 pars (4s) = 40+50 = 90...
// Let's just use: 9 fives + 9 fours = 45 + 36 = 81
const SCORES_81 = [...Array(9).fill(5), ...Array(9).fill(4)];
const TOTAL_81 = SCORES_81.reduce((a, b) => a + b, 0);

const mockRound = {
  id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
  profileId: TEST_PROFILE_ID,
  playbookId: TEST_PLAYBOOK_ID,
  courseId: TEST_COURSE_ID,
  roundDate: '2026-03-20',
  teeName: 'White',
  holeScores: SCORES_81,
  totalScore: TOTAL_81,
  notes: null,
  createdAt: new Date().toISOString(),
};

async function authedRequest(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const token = await makeToken(TEST_USER_ID);
  return roundRoutes.request(path, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /rounds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves a round and returns 201', async () => {
    mockSelect(mockDb, [mockProfile]);
    mockInsert(mockDb, [mockRound]);

    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: SCORES_81,
        totalScore: TOTAL_81,
      },
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.totalScore).toBe(TOTAL_81);
    expect(body.data.profileId).toBe(TEST_PROFILE_ID);
  });

  it('rejects when totalScore does not match sum of holeScores', async () => {
    mockSelect(mockDb, [mockProfile]);

    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: SCORES_81,
        totalScore: 100, // wrong! (SCORES_81 sums to 81, and 100 is within Zod's max(270))
      },
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("doesn't match hole scores sum");
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('rejects fewer than 18 hole scores', async () => {
    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: Array(17).fill(4), // only 17 scores
        totalScore: 68,
      },
    });

    expect(res.status).toBe(400);
  });

  it('rejects more than 18 hole scores', async () => {
    const scores = Array(19).fill(4);
    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: scores,
        totalScore: scores.reduce((a, b) => a + b, 0),
      },
    });

    expect(res.status).toBe(400);
  });

  it('rejects hole score of 0 (min is 1)', async () => {
    const scores = [...Array(17).fill(4), 0];
    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: scores,
        totalScore: scores.reduce((a, b) => a + b, 0),
      },
    });

    expect(res.status).toBe(400);
  });

  it('rejects hole score above 15 (max)', async () => {
    const scores = [...Array(17).fill(4), 16];
    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: scores,
        totalScore: scores.reduce((a, b) => a + b, 0),
      },
    });

    expect(res.status).toBe(400);
  });

  it('validates roundDate format', async () => {
    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: TEST_COURSE_ID,
        roundDate: 'March 20th', // invalid format
        teeName: 'White',
        holeScores: SCORES_81,
        totalScore: TOTAL_81,
      },
    });

    expect(res.status).toBe(400);
  });

  it('validates courseId must be UUID', async () => {
    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: 'not-a-uuid',
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: SCORES_81,
        totalScore: TOTAL_81,
      },
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 when profile not found', async () => {
    mockSelect(mockDb, []); // no profile

    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: SCORES_81,
        totalScore: TOTAL_81,
      },
    });

    expect(res.status).toBe(404);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('accepts optional playbookId as UUID', async () => {
    mockSelect(mockDb, [mockProfile]);
    mockInsert(mockDb, [mockRound]);

    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        playbookId: TEST_PLAYBOOK_ID,
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: SCORES_81,
        totalScore: TOTAL_81,
      },
    });

    expect(res.status).toBe(201);
  });

  it('rejects invalid playbookId (not a UUID)', async () => {
    const res = await authedRequest('/', {
      method: 'POST',
      body: {
        playbookId: 'abc',
        courseId: TEST_COURSE_ID,
        roundDate: '2026-03-20',
        teeName: 'White',
        holeScores: SCORES_81,
        totalScore: TOTAL_81,
      },
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /rounds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of rounds for the player', async () => {
    mockSelect(mockDb, [mockProfile]);
    mockSelect(mockDb, [mockRound]);

    const res = await authedRequest('/');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].totalScore).toBe(TOTAL_81);
  });

  it('returns empty array when no rounds', async () => {
    mockSelect(mockDb, [mockProfile]);
    mockSelect(mockDb, []);

    const res = await authedRequest('/');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it('returns 404 when profile not found', async () => {
    mockSelect(mockDb, []);

    const res = await authedRequest('/');
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await roundRoutes.request('/');
    expect(res.status).toBe(401);
  });
});
