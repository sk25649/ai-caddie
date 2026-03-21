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
const mockStream = vi.hoisted(() => vi.fn());

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate, stream: mockStream },
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
    expect((await res.json()).error).toContain('Claude API down');
  });

  it('retries when Claude returns non-text content type (treats as empty → invalid JSON)', async () => {
    setupHappyPath();
    // callClaudeWithRetry retries internally — DB is NOT re-queried between attempts
    // First attempt returns a tool_use block (non-text), second returns valid JSON
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'x', name: 'fn', input: {} }] })
      .mockResolvedValueOnce({ content: [{ type: 'text', text: JSON.stringify(mockPlaybookData) }] });
    mockInsert(mockDb, [mockPlaybook]);

    const res = await authedPost(VALID_BODY);
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledTimes(2);
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

// ── Streaming endpoint ────────────────────────────────────────────────────

function parseSSEEvents(text: string): Array<{ event: string; data: string }> {
  return text.split('\n\n').filter(Boolean).map((block) => {
    const lines = block.split('\n');
    const event = lines.find((l) => l.startsWith('event:'))?.slice(7) || '';
    const data = lines.find((l) => l.startsWith('data:'))?.slice(6) || '';
    return { event, data };
  });
}

async function authedStreamPost(body: unknown) {
  const token = await makeToken(TEST_USER_ID);
  return playbookRoutes.request('/generate-stream', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function setupStreamHappyPath() {
  // profile, cache miss, then Promise.all: [clubs, course, holes, fetchWeather→course]
  mockSelect(mockDb, [{ ...mockProfile, clubs: [] }]); // 1. profile
  mockSelect(mockDb, []);                               // 2. cache miss
  mockSelect(mockDb, []);                               // 3. clubs (Promise.all[0])
  mockSelect(mockDb, [mockCourse]);                     // 4. course (Promise.all[1])
  mockSelect(mockDb, Array.from({ length: 18 }, (_, i) => ({ ...mockHole, holeNumber: i + 1 }))); // 5. holes (Promise.all[2])
  mockSelect(mockDb, [mockCourse]);                     // 6. course (fetchWeather, Promise.all[3])
}

function makeMockClaudeStream(data: typeof mockPlaybookData) {
  const text = JSON.stringify(data);
  // Simulate an async iterable that yields text deltas
  const events = [
    { type: 'content_block_delta', delta: { type: 'text_delta', text } },
  ];
  return {
    [Symbol.asyncIterator]: () => {
      let i = 0;
      return {
        next: () => Promise.resolve(i < events.length ? { value: events[i++], done: false } : { value: undefined, done: true }),
      };
    },
  };
}

describe('POST /playbook/generate-stream — cache hit', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupWeatherFetch();
  });

  it('returns complete event for cached playbook', async () => {
    mockSelect(mockDb, [{ ...mockProfile }]); // profile
    mockSelect(mockDb, [mockPlaybook]);        // cache hit

    const res = await authedStreamPost(VALID_BODY);
    expect(res.status).toBe(200);

    const text = await res.text();
    const events = parseSSEEvents(text);
    expect(events[0].event).toBe('complete');
    expect(JSON.parse(events[0].data).id).toBe(TEST_PLAYBOOK_ID);
  });
});

describe('POST /playbook/generate-stream — fresh generation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupWeatherFetch();
  });

  it('emits meta, hole events, and done', async () => {
    setupStreamHappyPath();
    mockStream.mockReturnValueOnce(makeMockClaudeStream(mockPlaybookData));
    mockInsert(mockDb, [mockPlaybook]);

    const res = await authedStreamPost(VALID_BODY);
    expect(res.status).toBe(200);

    const text = await res.text();
    const events = parseSSEEvents(text);

    // First event is meta
    expect(events[0].event).toBe('meta');
    const meta = JSON.parse(events[0].data);
    expect(meta.pre_round_talk).toBe(mockPlaybookData.pre_round_talk);
    expect(meta.projected_score).toBe(mockPlaybookData.projected_score);

    // Next 18 events are holes
    const holeEvents = events.filter((e) => e.event === 'hole');
    expect(holeEvents.length).toBe(18);

    // Last event is done
    const doneEvent = events.find((e) => e.event === 'done');
    expect(doneEvent).toBeDefined();
    expect(JSON.parse(doneEvent!.data).id).toBe(TEST_PLAYBOOK_ID);
  });

  it('emits error event when Claude fails', async () => {
    setupStreamHappyPath();
    const failStream = {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new Error('Claude stream failed')),
      }),
    };
    mockStream.mockReturnValueOnce(failStream);

    const res = await authedStreamPost(VALID_BODY);
    const text = await res.text();
    const events = parseSSEEvents(text);

    const errorEvent = events.find((e) => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(JSON.parse(errorEvent!.data).error).toContain('Claude stream failed');
  });

  it('returns 404 when profile not found', async () => {
    mockSelect(mockDb, []); // no profile
    const res = await authedStreamPost(VALID_BODY);
    expect(res.status).toBe(404);
  });
});
