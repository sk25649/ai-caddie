import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToken, mockSelect, mockInsert, mockUpdate, mockDelete, mockProfile, mockClub, TEST_USER_ID, TEST_PROFILE_ID } from './helpers';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));

import { profileRoutes } from '../routes/profile';

// ── Helpers ────────────────────────────────────────────────────────────────

async function authedRequest(
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const token = await makeToken(TEST_USER_ID);
  return profileRoutes.request(path, {
    method: options.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns profile with clubs', async () => {
    mockSelect(mockDb, [mockProfile]); // profile lookup
    mockSelect(mockDb, [mockClub]);    // clubs lookup

    const res = await authedRequest('/');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.displayName).toBe('Test Player');
    expect(body.data.clubs).toHaveLength(1);
    expect(body.data.clubs[0].clubName).toBe('3-Hybrid');
  });

  it('returns 404 when no profile exists', async () => {
    mockSelect(mockDb, []); // no profile

    const res = await authedRequest('/');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Profile not found');
  });

  it('returns 401 without auth token', async () => {
    const res = await profileRoutes.request('/');
    expect(res.status).toBe(401);
  });

  it('returns empty clubs array when bag is empty', async () => {
    mockSelect(mockDb, [mockProfile]);
    mockSelect(mockDb, []); // no clubs

    const res = await authedRequest('/');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.clubs).toHaveLength(0);
  });
});

describe('PUT /profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates profile fields and returns updated record', async () => {
    const updated = { ...mockProfile, displayName: 'Updated Name', goalScore: 87 };
    mockSelect(mockDb, [mockProfile]);
    mockUpdate(mockDb, [updated]);

    const res = await authedRequest('/', {
      method: 'PUT',
      body: { displayName: 'Updated Name', goalScore: 87 },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.displayName).toBe('Updated Name');
  });

  it('rejects invalid stockShape', async () => {
    const res = await authedRequest('/', {
      method: 'PUT',
      body: { stockShape: 'hook' }, // not draw/fade/straight
    });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('rejects scores outside valid range', async () => {
    const res = await authedRequest('/', {
      method: 'PUT',
      body: { dreamScore: 200 }, // max is 150
    });

    expect(res.status).toBe(400);
  });

  it('returns 404 if profile does not exist', async () => {
    mockSelect(mockDb, []); // no profile found

    const res = await authedRequest('/', {
      method: 'PUT',
      body: { displayName: 'Ghost' },
    });

    expect(res.status).toBe(404);
  });

  it('sets updatedAt when saving', async () => {
    mockSelect(mockDb, [mockProfile]);
    mockUpdate(mockDb, [mockProfile]);

    await authedRequest('/', { method: 'PUT', body: { displayName: 'X' } });

    const setCall = mockDb.update.mock.results[0]?.value?.set?.mock?.calls[0]?.[0];
    expect(setCall?.updatedAt).toBeInstanceOf(Date);
  });
});

describe('PUT /profile/clubs', () => {
  beforeEach(() => vi.clearAllMocks());

  const validClubs = [
    { clubName: 'Driver', clubType: 'driver', carryDistance: 240 },
    { clubName: '7-Iron', clubType: 'iron', carryDistance: 165 },
  ];

  it('deletes existing clubs then inserts new ones', async () => {
    mockSelect(mockDb, [mockProfile]);
    mockDelete(mockDb);
    mockInsert(mockDb, [mockClub]);

    const res = await authedRequest('/clubs', { method: 'PUT', body: { clubs: validClubs } });

    expect(res.status).toBe(200);
    // delete MUST happen before insert
    const deleteCallOrder = mockDb.delete.mock.invocationCallOrder[0];
    const insertCallOrder = mockDb.insert.mock.invocationCallOrder[0];
    expect(deleteCallOrder).toBeLessThan(insertCallOrder);
  });

  it('assigns sortOrder by array index when not provided', async () => {
    mockSelect(mockDb, [mockProfile]);
    mockDelete(mockDb);
    mockInsert(mockDb, [mockClub]);

    await authedRequest('/clubs', { method: 'PUT', body: { clubs: validClubs } });

    const insertedValues = mockDb.insert.mock.results[0]?.value?.values?.mock?.calls[0]?.[0];
    expect(insertedValues[0].sortOrder).toBe(0);
    expect(insertedValues[1].sortOrder).toBe(1);
  });

  it('rejects empty clubs array (min 1)', async () => {
    const res = await authedRequest('/clubs', { method: 'PUT', body: { clubs: [] } });
    expect(res.status).toBe(400);
  });

  it('rejects more than 20 clubs (max)', async () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => ({
      clubName: `Club${i}`,
      clubType: 'iron',
    }));
    const res = await authedRequest('/clubs', { method: 'PUT', body: { clubs: tooMany } });
    expect(res.status).toBe(400);
  });

  it('rejects invalid clubType', async () => {
    const res = await authedRequest('/clubs', {
      method: 'PUT',
      body: { clubs: [{ clubName: 'Wand', clubType: 'magic' }] },
    });
    expect(res.status).toBe(400);
  });

  it('rejects carryDistance above 400', async () => {
    const res = await authedRequest('/clubs', {
      method: 'PUT',
      body: { clubs: [{ clubName: 'Rocket', clubType: 'driver', carryDistance: 500 }] },
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 if profile does not exist', async () => {
    mockSelect(mockDb, []);
    const res = await authedRequest('/clubs', { method: 'PUT', body: { clubs: validClubs } });
    expect(res.status).toBe(404);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });
});
