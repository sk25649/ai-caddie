import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeToken, makeExpiredToken, mockSelect, mockInsert, mockInsertVoid, mockUser, mockProfile, TEST_USER_ID } from './helpers';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('../db', () => ({ db: mockDb }));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { authRoutes } from '../routes/auth';
import bcrypt from 'bcrypt';

// ── Helpers ────────────────────────────────────────────────────────────────

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return authRoutes.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /signup', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates user, profile, and returns token', async () => {
    mockSelect(mockDb, []); // no existing user
    mockInsert(mockDb, [mockUser]);
    mockInsertVoid(mockDb); // create profile

    const res = await post('/signup', { email: 'new@example.com', password: 'password123' });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.token).toBeDefined();
    expect(body.data.userId).toBe(TEST_USER_ID);
    expect(mockDb.insert).toHaveBeenCalledTimes(2); // users + playerProfiles
  });

  it('rejects invalid email', async () => {
    const res = await post('/signup', { email: 'not-an-email', password: 'password123' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('rejects password shorter than 8 chars', async () => {
    const res = await post('/signup', { email: 'test@example.com', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email already registered', async () => {
    mockSelect(mockDb, [mockUser]); // existing user found

    const res = await post('/signup', { email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Email already registered');
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('hashes password with cost 12', async () => {
    mockSelect(mockDb, []);
    mockInsert(mockDb, [mockUser]);
    mockInsertVoid(mockDb);

    await post('/signup', { email: 'new@example.com', password: 'password123' });
    expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
  });
});

describe('POST /login', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns token for valid credentials', async () => {
    mockSelect(mockDb, [mockUser]);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    const res = await post('/login', { email: 'test@example.com', password: 'correct' }, { 'x-forwarded-for': '1.2.3.4' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.token).toBeDefined();
  });

  it('works without x-forwarded-for header (uses "unknown" IP bucket)', async () => {
    mockSelect(mockDb, [mockUser]);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true);

    // No x-forwarded-for header — exercises the || 'unknown' fallback
    const res = await post('/login', { email: 'test@example.com', password: 'correct' });
    expect(res.status).toBe(200);
  });

  it('returns 401 when user not found', async () => {
    mockSelect(mockDb, []); // no user

    const res = await post('/login', { email: 'nobody@example.com', password: 'pw' }, { 'x-forwarded-for': '1.2.3.5' });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid credentials');
  });

  it('returns 401 when password is wrong', async () => {
    mockSelect(mockDb, [mockUser]);
    (bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);

    const res = await post('/login', { email: 'test@example.com', password: 'wrong' }, { 'x-forwarded-for': '1.2.3.6' });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid credentials');
  });

  it('returns 401 when user has no passwordHash (Apple-only account)', async () => {
    mockSelect(mockDb, [{ ...mockUser, passwordHash: null }]);

    const res = await post('/login', { email: 'test@example.com', password: 'pw' }, { 'x-forwarded-for': '1.2.3.7' });
    expect(res.status).toBe(401);
    // bcrypt.compare should NOT be called for Apple-only accounts
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('returns 400 when login body is missing required fields', async () => {
    const res = await post('/login', { email: 'not-an-email' }, { 'x-forwarded-for': '2.2.2.2' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('returns 400 when login body has invalid email format', async () => {
    const res = await post('/login', { email: 'notanemail', password: 'pw' }, { 'x-forwarded-for': '2.2.2.3' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Validation failed');
  });

  it('rate limits after 10 failed attempts from same IP', async () => {
    const ip = '9.9.9.9'; // unique IP to avoid pollution from other tests
    // 10 attempts each need a user lookup that returns nothing
    for (let i = 0; i < 10; i++) {
      mockSelect(mockDb, []);
    }
    for (let i = 0; i < 10; i++) {
      await post('/login', { email: 'x@x.com', password: 'pw' }, { 'x-forwarded-for': ip });
    }

    // 11th attempt should be rate limited (no DB mock needed)
    const res = await post('/login', { email: 'x@x.com', password: 'pw' }, { 'x-forwarded-for': ip });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain('Too many login attempts');
  });
});

describe('POST /apple', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates new user+profile for new Apple ID', async () => {
    mockSelect(mockDb, []); // no existing user by appleId
    mockInsert(mockDb, [{ ...mockUser, appleId: 'apple_123', email: 'apple@icloud.com' }]);
    mockInsertVoid(mockDb); // create profile

    const res = await post('/apple', { appleId: 'apple_123', email: 'apple@icloud.com', fullName: 'Test User' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.token).toBeDefined();
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('returns existing user for known Apple ID', async () => {
    mockSelect(mockDb, [{ ...mockUser, appleId: 'apple_existing' }]);

    const res = await post('/apple', { appleId: 'apple_existing' });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.token).toBeDefined();
    expect(mockDb.insert).not.toHaveBeenCalled(); // no new records
  });

  it('rejects missing appleId', async () => {
    const res = await post('/apple', { email: 'test@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('authMiddleware', () => {
  // Test via a protected route (profile) — middleware blocks before route logic
  it('rejects requests with no Authorization header', async () => {
    const { profileRoutes } = await import('../routes/profile');
    const res = await profileRoutes.request('/');
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Unauthorized');
  });

  it('rejects requests with malformed Authorization header', async () => {
    const { profileRoutes } = await import('../routes/profile');
    const res = await profileRoutes.request('/', {
      headers: { Authorization: 'Token abc123' }, // not "Bearer"
    });
    expect(res.status).toBe(401);
  });

  it('rejects expired tokens', async () => {
    const { profileRoutes } = await import('../routes/profile');
    const token = await makeExpiredToken(TEST_USER_ID);
    const res = await profileRoutes.request('/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('Invalid or expired token');
  });

  it('rejects tokens signed with wrong secret', async () => {
    const { profileRoutes } = await import('../routes/profile');
    // Sign with a DIFFERENT secret
    const { SignJWT } = await import('jose');
    const wrongSecret = new TextEncoder().encode('wrong-secret-that-is-also-32-chars-long-here');
    const badToken = await new SignJWT({ sub: TEST_USER_ID })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(wrongSecret);

    const res = await profileRoutes.request('/', {
      headers: { Authorization: `Bearer ${badToken}` },
    });
    expect(res.status).toBe(401);
  });

  it('passes valid tokens through to the route handler', async () => {
    mockSelect(mockDb, [mockProfile]); // profile lookup
    mockSelect(mockDb, []); // clubs lookup

    const { profileRoutes } = await import('../routes/profile');
    const token = await makeToken(TEST_USER_ID);
    const res = await profileRoutes.request('/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    // Should NOT be 401 — auth passed (may be 404 if no profile, or 200)
    expect(res.status).not.toBe(401);
  });
});
