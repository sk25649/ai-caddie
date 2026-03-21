# AI Caddie

React Native app that generates personalized hole-by-hole golf strategy playbooks for recreational golfers.

## Architecture

Monorepo — two apps, one deployment:

- `apps/api/` — Hono API (Node.js + tsx, Drizzle ORM, PostgreSQL, Railway)
- `apps/mobile/` — Expo React Native (Expo Router, Nativewind, Zustand, React Query)

## API Server (`apps/api/`)

### Commands

```
npm run dev          # Dev server with hot reload (uses .env)
npm run start        # Production start (used by Railway)
npm run db:generate  # Generate Drizzle migration files
npm run db:migrate   # Apply migrations to DB
npm run db:seed      # Seed 20 LA courses via Claude API
npm run typecheck    # TypeScript check (no emit)
npm test             # Vitest
```

### Env vars

| Var | Purpose |
|-----|---------|
| `DATABASE_PUBLIC_URL` | Railway Postgres public URL (preferred) |
| `DATABASE_URL` | Fallback DB URL |
| `JWT_SECRET` | Signs JWTs (30d expiry) |
| `ANTHROPIC_API_KEY` | Claude API for playbook generation |
| `OPENWEATHER_KEY` | Weather at tee time |

### Route structure

```
/auth        POST /signup, POST /login, POST /apple
/profile     GET /, PUT /, PUT /clubs
/courses     GET /, GET /:slug, GET /:slug/holes
/playbook    POST /generate, POST /generate-from-description
             GET /:id, GET /:id/yardage-book, PATCH /:id/notes
/rounds      GET /, POST /
```

All routes except `/auth` require `Authorization: Bearer <token>`.

### API response format

All responses wrap data:
```json
{ "data": { ... } }       // success
{ "error": "...", "details": ... }  // failure
```

The `ApiClient` in mobile (`lib/api.ts`) reads `res.data` automatically — API routes must always return `{ data: ... }`.

### DB conventions

- ORM: Drizzle with `drizzle-orm/postgres-js`
- Connection via `process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL`
- Migrations in `apps/api/drizzle/` — run `db:generate` then `db:migrate` after schema changes
- **Always wrap DB queries in try/catch** and return `{ error: "Database error: ..." }` — unhandled DB throws become generic 500s
- Schema types: use `typeof table.$inferSelect` for typed query results

### Auth middleware

`authMiddleware` from `routes/auth.ts` — sets `c.get('userId')`. Type the Hono app with `AppEnv` from `lib/types.ts`:
```ts
const router = new Hono<AppEnv>();
router.use('*', authMiddleware);
const userId = c.get('userId') as string;
```

### Claude API

- **Always use `claude-sonnet-4-6`** — never use dated model IDs like `claude-sonnet-4-20250514` (they get deprecated)
- Playbook generation uses `CADDIE_SYSTEM_PROMPT` + `buildPlaybookPrompt` / `buildCustomCoursePrompt` from `lib/prompts.ts`
- Retry logic in `callClaudeWithRetry` (2 attempts) — returns 502 on final failure
- Strips markdown code fences before `JSON.parse`

### Deployment (Railway)

- Dockerfile at `apps/api/Dockerfile`, build context is repo root
- `railway.toml` configures build + health check at `/health`
- **`hostname: '0.0.0.0'`** is required in `serve()` — Railway's proxy can't reach `127.0.0.1`
- **`serve()` must be called before any async DB operations** — otherwise health check times out during startup
- `tsx` must be in `dependencies` (not devDependencies) — Railway sets `NODE_ENV=production`
- `.dockerignore` excludes `**/node_modules` — prevents local macOS binaries from overwriting Linux ones
- Migrations do NOT run automatically — run `db:migrate` manually or as a one-off Railway job after schema changes

---

## Mobile App (`apps/mobile/`)

### Commands

```
npx expo start            # Start dev server
npx expo start --clear    # Clear cache (required after dependency changes)
```

### Env vars

```
EXPO_PUBLIC_API_URL=https://ai-caddie-production.up.railway.app
```

### Navigation (Expo Router)

File-based routing. Stack layout in `app/_layout.tsx` with `headerShown: false` globally — **all screens need manual back buttons**.

```
app/
  index.tsx              # Home (requires auth + onboarding)
  (auth)/login.tsx
  (auth)/signup.tsx
  onboarding/basics.tsx → shot-shape.tsx → goals.tsx → bag.tsx
  round/course-select.tsx → tee-select.tsx → details.tsx → playbook.tsx
  post-round/summary.tsx
  settings/profile.tsx
```

Back navigation pattern (use everywhere, since header is hidden):
```tsx
<Pressable onPress={() => router.back()} className="py-2 self-start">
  <Text className="text-gold text-base">‹ Back</Text>
</Pressable>
```

### Styling (Nativewind)

Tailwind classes via Nativewind. Custom theme colors — always use these, never hardcode hex:

| Token | Value | Use for |
|-------|-------|---------|
| `bg-green-deep` | `#0a1a0a` | Page backgrounds |
| `bg-green-card` | `#0f200f` | Cards, modals |
| `text-gold` | `#d4a843` | Primary accent, labels |
| `text-gold-dim` | `#a08030` | Secondary gold |
| `text-cream` | `#f0e8d8` | Primary text |
| `text-cream-dim` | `#b8a888` | Secondary text |
| `text-danger` | `#e05545` | Errors |
| `text-par-green` | `#3dbd6e` | Positive stats |

Fonts: `fontFamily: 'serif'` for display headings (DM Serif Display), default body is DM Sans.

### State management

Two Zustand stores — no Redux, no Context for app state.

**`authStore`** — token, userId, isAuthenticated, init/setAuth/logout
**`roundStore`** — full round flow state: selectedCourse, selectedTee, playbook, scores, currentHole, holesCount, holeNotes, isCompetitionMode, custom course fields

Round flow: `setCourse` → `setTee` → `setRoundDetails` → `setPlaybook` → track scores → reset

### Data fetching (React Query)

- Queries: `useProfile`, `useCourses` in `hooks/`
- Mutations: `useGeneratePlaybook`, `useGeneratePlaybookFromDescription` in `hooks/usePlaybook.ts`
- API client singleton: `api` from `lib/api.ts` — use `api.get/post/put/patch`, never raw `fetch`
- Errors throw `ApiError` (extends `Error`) with `.status` and `.details`
- Display errors: `mutation.error?.message` gives the server's error string

### Local storage

`lib/storage.ts` wraps `expo-secure-store` for:
- `auth_token`, `auth_user_id` — managed by authStore
- `last_playbook` — cached playbook
- `onboarding_complete` — gates onboarding redirect

### Playbook flow

1. User selects course (DB) or describes custom course
2. Selects tee, date, tee time, scoring goal
3. `POST /playbook/generate` or `/playbook/generate-from-description`
4. Server fetches profile + clubs + course + holes + weather, calls Claude
5. Playbook cached in DB (keyed by profileId + courseId + teeName + roundDate)
6. Mobile stores in roundStore + SecureStore

### Design principles

- **Bogey-first mindset**: bogey is par, pars are bonuses — this should be reflected in all copy and playbook framing
- Competition mode: hides strategy on-course (Rule 4.3), shows only scores
- `holesCount` supports 9 or 18 holes — slice `holeStrategies` and `scores` accordingly
- Hole notes auto-save with 800ms debounce via `PATCH /playbook/:id/notes`
