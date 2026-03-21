import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  boolean,
  jsonb,
  timestamp,
  date,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============ AUTH ============

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  appleId: text('apple_id').unique(),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ PLAYER ============

export const playerProfiles = pgTable('player_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .unique()
    .notNull(),
  displayName: text('display_name'),
  handicap: decimal('handicap'),

  stockShape: text('stock_shape'),
  missPrimary: text('miss_primary'),
  missSecondary: text('miss_secondary'),
  missDescription: text('miss_description'),

  dreamScore: integer('dream_score'),
  goalScore: integer('goal_score'),
  floorScore: integer('floor_score'),

  updatedAt: timestamp('updated_at').defaultNow(),
});

export const playerClubs = pgTable('player_clubs', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .references(() => playerProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  clubName: text('club_name').notNull(),
  clubType: text('club_type').notNull(),
  carryDistance: integer('carry_distance'),
  totalDistance: integer('total_distance'),
  isFairwayFinder: boolean('is_fairway_finder').default(false),
  notes: text('notes'),
  sortOrder: integer('sort_order').default(0),
});

// ============ COURSE ============

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  city: text('city'),
  state: text('state'),
  zip: text('zip'),
  latitude: decimal('latitude'),
  longitude: decimal('longitude'),
  par: integer('par').notNull(),

  tees: jsonb('tees').notNull(),
  courseIntel: jsonb('course_intel'),

  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

export const holes = pgTable(
  'holes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id')
      .references(() => courses.id, { onDelete: 'cascade' })
      .notNull(),
    holeNumber: integer('hole_number').notNull(),
    par: integer('par').notNull(),
    handicapIndex: integer('handicap_index'),

    yardages: jsonb('yardages').notNull(),
    holeIntel: jsonb('hole_intel').notNull(),
  },
  (table) => ({
    uniqueHole: uniqueIndex('unique_hole').on(table.courseId, table.holeNumber),
  })
);

// ============ PLAYBOOK ============

export const playbooks = pgTable(
  'playbooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .references(() => playerProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    courseId: uuid('course_id')
      .references(() => courses.id),

    teeName: text('tee_name').notNull(),
    scoringGoal: text('scoring_goal'),
    weatherConditions: jsonb('weather_conditions'),
    roundDate: date('round_date'),
    teeTime: text('tee_time'),

    preRoundTalk: text('pre_round_talk'),
    holeStrategies: jsonb('hole_strategies').notNull(),
    projectedScore: integer('projected_score'),
    driverHoles: jsonb('driver_holes'),
    parChanceHoles: jsonb('par_chance_holes'),
    caddieNotes: jsonb('caddie_notes'),

    generatedAt: timestamp('generated_at').defaultNow(),
  },
  (table) => ({
    uniquePlaybook: uniqueIndex('unique_playbook').on(
      table.profileId,
      table.courseId,
      table.teeName,
      table.roundDate
    ),
  })
);

// ============ ROUND SCORES ============

export const roundScores = pgTable('round_scores', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .references(() => playerProfiles.id, { onDelete: 'cascade' })
    .notNull(),
  playbookId: uuid('playbook_id').references(() => playbooks.id),
  courseId: uuid('course_id').references(() => courses.id),
  roundDate: date('round_date'),
  teeName: text('tee_name'),
  holeScores: jsonb('hole_scores'),
  totalScore: integer('total_score'),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// ============ TYPE HELPERS ============

export interface TeeInfo {
  name: string;
  color: string;
  totalYardage: number;
  rating: number;
  slope: number;
}

export interface CourseIntel {
  overview: string;
  windPatterns: string;
  greenSpeed: string;
  keyFeatures: string;
  difficultyNotes: string;
}

export interface HoleIntel {
  name: string;
  shape: string;
  greenDepthYards: number;
  greenFeatures: string;
  hazards: Array<{
    type: string;
    location: string;
    severity: string;
  }>;
  fairwayWidth: string;
  elevationChange: string;
  prevailingWindEffect: string;
  keyNotes: string;
}

export interface HoleStrategy {
  hole_number: number;
  yardage: number;
  par: number;
  tee_club: string;
  // Structured fields (new playbooks)
  aim_point?: string;
  carry_target?: number;
  play_bullets?: string[];
  terrain_note?: string;
  // Legacy fields (kept for backward compat with cached playbooks)
  strategy?: string;
  scoring_mindset?: string;
  miss_left: string;
  miss_right: string;
  miss_short: string;
  danger: string;
  target: string;
  is_par_chance: boolean;
  do_this?: string[];
  dont_do?: string[];
  approach_club?: string;
  approach_distance?: number;
}

export interface WeatherForecast {
  temp: number;
  wind_speed: number;
  wind_deg: number;
  weather: Array<{ description: string }>;
}
