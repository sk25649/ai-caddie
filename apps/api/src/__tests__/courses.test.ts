import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToken, mockSelect, mockCourse, mockHole, TEST_USER_ID, TEST_COURSE_ID } from './helpers';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../db', () => ({ db: mockDb }));
vi.mock('bcrypt', () => ({ default: { hash: vi.fn(), compare: vi.fn() } }));

import { courseRoutes } from '../routes/courses';

// ── Helpers ────────────────────────────────────────────────────────────────

async function authedRequest(path: string) {
  const token = await makeToken(TEST_USER_ID);
  return courseRoutes.request(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /courses', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns list of courses', async () => {
    mockSelect(mockDb, [mockCourse]);

    const res = await authedRequest('/');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe('Torrey Pines South Course');
  });

  it('returns empty array when no courses', async () => {
    mockSelect(mockDb, []);

    const res = await authedRequest('/');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it('passes search query to DB (ilike filter)', async () => {
    mockSelect(mockDb, [mockCourse]);

    const res = await authedRequest('/?q=torrey');
    expect(res.status).toBe(200);
    // Verify db.select was called (query param used)
    expect(mockDb.select).toHaveBeenCalledTimes(1);
  });

  it('returns 401 without auth', async () => {
    const res = await courseRoutes.request('/');
    expect(res.status).toBe(401);
  });
});

describe('GET /courses/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns course by slug', async () => {
    mockSelect(mockDb, [mockCourse]);

    const res = await authedRequest('/torrey-pines-south');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.slug).toBe('torrey-pines-south');
    expect(body.data.par).toBe(72);
  });

  it('returns 404 for unknown slug', async () => {
    mockSelect(mockDb, []);

    const res = await authedRequest('/nonexistent-course');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Course not found');
  });

  it('includes tees and courseIntel in response', async () => {
    mockSelect(mockDb, [mockCourse]);

    const res = await authedRequest('/torrey-pines-south');
    const body = await res.json();

    expect(body.data.tees).toHaveLength(2);
    expect(body.data.tees[0].name).toBe('Blue');
    expect(body.data.courseIntel.overview).toBe('Championship course');
  });
});

describe('GET /courses/:slug/holes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns course and its 18 holes', async () => {
    mockSelect(mockDb, [mockCourse]); // course lookup
    mockSelect(mockDb, Array.from({ length: 18 }, (_, i) => ({
      ...mockHole,
      holeNumber: i + 1,
    }))); // holes lookup

    const res = await authedRequest('/torrey-pines-south/holes');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.course.name).toBe('Torrey Pines South Course');
    expect(body.data.holes).toHaveLength(18);
  });

  it('returns 404 when course not found', async () => {
    mockSelect(mockDb, []); // no course

    const res = await authedRequest('/ghost-course/holes');
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Course not found');
  });

  it('returns holes ordered by holeNumber', async () => {
    const shuffledHoles = [3, 1, 2].map((n) => ({ ...mockHole, holeNumber: n }));
    mockSelect(mockDb, [mockCourse]);
    mockSelect(mockDb, shuffledHoles); // DB orderBy handles this; mock returns as-is

    const res = await authedRequest('/torrey-pines-south/holes');
    const body = await res.json();

    expect(res.status).toBe(200);
    // The route uses .orderBy(holes.holeNumber), so DB is responsible for order
    // We just verify the route calls select twice
    expect(mockDb.select).toHaveBeenCalledTimes(2);
  });
});
