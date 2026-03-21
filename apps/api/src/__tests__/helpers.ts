import { SignJWT } from 'jose';
import { vi } from 'vitest';

// ── JWT ──────────────────────────────────────────────────────────────────────

const TEST_SECRET = new TextEncoder().encode(
  'test-jwt-secret-must-be-at-least-32-chars-long'
);

export async function makeToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(TEST_SECRET);
}

export async function makeExpiredToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(0) // expires immediately
    .sign(TEST_SECRET);
}

// ── DB mock chain builders ────────────────────────────────────────────────────
//
// Drizzle's query builder returns a "lazy thenable" that can be:
//   - awaited directly:          await db.select().from(t).where(c)
//   - chained with orderBy():    await db.select().from(t).where(c).orderBy(col)
//
// We model this by returning a Promise extended with extra methods.

function makeThenable(result: unknown[]) {
  return Object.assign(Promise.resolve(result), {
    orderBy: vi.fn().mockResolvedValue(result),
    where: vi.fn().mockReturnValue(Object.assign(Promise.resolve(result), {
      orderBy: vi.fn().mockResolvedValue(result),
    })),
  });
}

/** Configure db.select for one or more sequential calls returning different rows */
export function mockSelect(mockDb: { select: ReturnType<typeof vi.fn> }, ...results: unknown[][]) {
  results.forEach((result) => {
    const thenable = makeThenable(result);
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue(
          Object.assign(Promise.resolve(result), {
            orderBy: vi.fn().mockResolvedValue(result),
          })
        ),
        orderBy: vi.fn().mockResolvedValue(result),
      }),
    });
  });
}

export function mockInsert(mockDb: { insert: ReturnType<typeof vi.fn> }, result: unknown[]) {
  const onConflictChain = { returning: vi.fn().mockResolvedValue(result) };
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(result),
      onConflictDoUpdate: vi.fn().mockReturnValue(onConflictChain),
    }),
  });
}

/** Insert with no .returning() call (e.g., profile creation) */
export function mockInsertVoid(mockDb: { insert: ReturnType<typeof vi.fn> }) {
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockResolvedValue(undefined),
  });
}

export function mockUpdate(mockDb: { update: ReturnType<typeof vi.fn> }, result: unknown[]) {
  mockDb.update.mockReturnValueOnce({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(result),
      }),
    }),
  });
}

export function mockDelete(mockDb: { delete: ReturnType<typeof vi.fn> }) {
  mockDb.delete.mockReturnValueOnce({
    where: vi.fn().mockResolvedValue(undefined),
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const TEST_USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
export const TEST_PROFILE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
export const TEST_COURSE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
export const TEST_PLAYBOOK_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

export const mockUser = {
  id: TEST_USER_ID,
  email: 'test@example.com',
  passwordHash: '$2b$12$hashedpassword',
  appleId: null,
  createdAt: new Date().toISOString(),
};

export const mockProfile = {
  id: TEST_PROFILE_ID,
  userId: TEST_USER_ID,
  displayName: 'Test Player',
  handicap: '18',
  stockShape: 'draw',
  missPrimary: 'High hook left',
  missSecondary: 'Slice right',
  missDescription: null,
  dreamScore: 85,
  goalScore: 89,
  floorScore: 99,
  updatedAt: new Date().toISOString(),
};

export const mockClub = {
  id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  profileId: TEST_PROFILE_ID,
  clubName: '3-Hybrid',
  clubType: 'hybrid',
  carryDistance: 210,
  totalDistance: 225,
  isFairwayFinder: true,
  notes: null,
  sortOrder: 0,
};

export const mockCourse = {
  id: TEST_COURSE_ID,
  name: 'Torrey Pines South Course',
  slug: 'torrey-pines-south',
  city: 'La Jolla',
  state: 'CA',
  zip: '92037',
  par: 72,
  latitude: '32.9005',
  longitude: '-117.2524',
  tees: [
    { name: 'Blue', color: '#0000ff', totalYardage: 7607, rating: 78.5, slope: 145 },
    { name: 'White', color: '#ffffff', totalYardage: 6874, rating: 74.6, slope: 138 },
  ],
  courseIntel: { overview: 'Championship course', windPatterns: 'Ocean breeze' },
  isActive: true,
  createdAt: new Date().toISOString(),
};

export const mockHole = {
  id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
  courseId: TEST_COURSE_ID,
  holeNumber: 1,
  par: 4,
  handicapIndex: 11,
  yardages: { Blue: 452, White: 409 },
  holeIntel: { shape: 'straight', fairwayWidth: 'medium', hazards: [] },
};

export const mockPlaybookData = {
  pre_round_talk: 'Stay patient, bogey is your par.',
  projected_score: 89,
  driver_holes: [9, 18],
  par_chance_holes: [1, 4, 7],
  holes: Array.from({ length: 18 }, (_, i) => ({
    hole_number: i + 1,
    yardage: 400,
    par: 4,
    tee_club: '3-Hybrid',
    aim_point: 'left edge of right fairway bunker',
    carry_target: 210,
    play_bullets: [
      'Hit 3-Hybrid to left edge of bunker.',
      'Approach with 7-iron from 160.',
      'Bogey is the goal here.',
    ],
    terrain_note: '',
    miss_left: 'Rough left, pitch out.',
    miss_right: 'Rough right, pitch out.',
    miss_short: 'Advance to wedge distance.',
    danger: 'OB left.',
    target: 'Bogey',
    is_par_chance: i < 3,
  })),
};

export const mockPlaybook = {
  id: TEST_PLAYBOOK_ID,
  profileId: TEST_PROFILE_ID,
  courseId: TEST_COURSE_ID,
  teeName: 'White',
  scoringGoal: 'Break 90',
  weatherConditions: {},
  roundDate: '2026-03-20',
  teeTime: '10:00',
  preRoundTalk: mockPlaybookData.pre_round_talk,
  holeStrategies: mockPlaybookData.holes,
  projectedScore: mockPlaybookData.projected_score,
  driverHoles: mockPlaybookData.driver_holes,
  parChanceHoles: mockPlaybookData.par_chance_holes,
  generatedAt: new Date().toISOString(),
};
