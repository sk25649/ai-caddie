import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToken, mockSelect, mockInsert, mockProfile, mockCourse, mockHole, mockPlaybook, mockPlaybookData, TEST_USER_ID, TEST_PROFILE_ID, TEST_COURSE_ID, TEST_PLAYBOOK_ID } from './helpers';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}));

import { playbookRoutes } from '../routes/playbook';

// ── Helpers ────────────────────────────────────────────────────────────────

const VALID_BODY = {
  courseId: TEST_COURSE_ID,
  teeName: 'White',
  roundDate: '2026-03-20',
  teeTime: '10:00',
  scoringGoal: 'Break 90',
};

async function authedPost(body: unknown) {
  const token = await makeToken(TEST_USER_ID);
  return playbookRoutes.request('/generate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function authedGet(path: string) {
  const token = await makeToken(TEST_USER_ID);
  return playbookRoutes.request(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function setupWeatherFetch(data: Record<string, unknown> = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({
      current: { temp: 72, wind_speed: 8, wind_deg: 180, weather: [{ description: 'sunny' }] },
      ...data,
    }),
  }));
}

function setupHappyPath() {
  mockSelect(mockDb, [{ ...mockProfile, clubs: [] }]); // profile
  mockSelect(mockDb, []);                               // cache miss
  mockSelect(mockDb, []);                               // clubs
  mockSelect(mockDb, [mockCourse]);                     // course
  mockSelect(mockDb, Array.from({ length: 18 }, (_, i) => ({ ...mockHole, holeNumber: i + 1 }))); // holes
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /playbook/generate — cache hit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupWeatherFetch();
  });

  it('returns cached playbook without calling Claude', async () => {
    mockSelect(mockDb, [{ ...mockProfile, clubs: [] }]); // profile
    mockSelect(mockDb, [mockPlaybook]);                  // cache hit!

    const res = await authedPost(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe(TEST_PLAYBOOK_ID);
    expect(mockCreate).not.toHaveBeenCalled(); // Claude never called
  });
});

describe('POST /playbook/generate — fresh generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupWeatherFetch();
  });

  it('generates and caches a new playbook', async () => {
    setupHappyPath();
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(mockPlaybookData) }],
    });
    mockInsert(mockDb, [mockPlaybook]);

    const res = await authedPost(VALID_BODY);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.preRoundTalk).toBe(mockPlaybookData.pre_round_talk);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('strips markdown fences from Claude JSON response', async () => {
    // This tests the bug fix: Claude sometimes wraps JSON in ```json ... ```
    setupHappyPath();
    const markdownWrapped = `\`\`\`json\n${JSON.stringify(mockPlaybookData)}\n\`\`\``;
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: markdownWrapped }],
    });
    mockInsert(mockDb, [mockPlaybook]);

    const res = await authedPost(VALID_BODY);
    expect(res.status).toBe(201); // Parsed successfully despite markdown
  });

  it('strips plain ``` fences too', async () => {
    setupHappyPath();
    const backtickWrapped = `\`\`\`\n${JSON.stringify(mockPlaybookData)}\n\`\`\``;
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: backtickWrapped }],
    });
    mockInsert(mockDb, [mockPlaybook]);

    const res = await authedPost(VALID_BODY);
    expect(res.status).toBe(201);
  });

  it('returns 502 when Claude fails both attempts', async () => {
    setupHappyPath();
    mockCreate.mockRejectedValue(new Error('Claude API down'));

    const res = await authedPost(VALID_BODY);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain('Failed to generate playbook');
  });

  it('retries once on invalid JSON from Claude', async () => {
    setupHappyPath();
    // callClaudeWithRetry retries internally — DB is NOT re-queried between attempts
    // First attempt returns invalid JSON, second returns valid
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'not valid json {{{' }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(mockPlaybookData) }] });
    mockInsert(mockDb, [mockPlaybook]);

    const res = await authedPost(VALID_BODY);
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(2); // retried once
  });

  it('returns 404 when player profile not found', async () => {
    mockSelect(mockDb, []); // no profile

    const res = await authedPost(VALID_BODY);
    expect(res.status).toBe(404);
    expect((await res.json()).error).toContain('Complete onboarding');
  });

  it('returns 404 when course not found', async () => {
    mockSelect(mockDb, [mockProfile]); // profile found
    mockSelect(mockDb, []);            // cache miss
    mockSelect(mockDb, []);            // clubs
    mockSelect(mockDb, []);            // course not found!

    const res = await authedPost(VALID_BODY);
    expect(res.status).toBe(404);
  });

  it('proceeds without weather when OpenWeather fails', async () => {
    setupHappyPath();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: JSON.stringify(mockPlaybookData) }],
    });
    mockInsert(mockDb, [mockPlaybook]);

    const res = await authedPost(VALID_BODY);
    // Should still succeed — weather failure is non-fatal
    expect(res.status).toBe(201);
  });

  it('validates courseId must be UUID', async () => {
    const res = await authedPost({ ...VALID_BODY, courseId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });

  it('validates roundDate format YYYY-MM-DD', async () => {
    const res = await authedPost({ ...VALID_BODY, roundDate: '03/20/2026' });
    expect(res.status).toBe(400);
  });

  it('validates teeTime format HH:MM', async () => {
    const res = await authedPost({ ...VALID_BODY, teeTime: '10am' });
    expect(res.status).toBe(400);
  });
});

describe('GET /playbook/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns playbook by ID', async () => {
    mockSelect(mockDb, [mockPlaybook]);

    const res = await authedGet(`/${TEST_PLAYBOOK_ID}`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe(TEST_PLAYBOOK_ID);
  });

  it('returns 404 for unknown ID', async () => {
    mockSelect(mockDb, []);

    const res = await authedGet('/ffffffff-ffff-ffff-ffff-ffffffffffff');
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid UUID format', async () => {
    const res = await authedGet('/not-a-valid-uuid');
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid playbook ID');
  });
});
