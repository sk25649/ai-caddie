# Roadmap — AI Caddie

**Last updated:** 2026-03-21

## Progress

### Feature: Competitive Mode — Pending
- [ ] Chunk 1: Any-course playbook via text description
- [x] Chunk 2: Add print-optimized fields to prompt schema
- [x] Chunk 3: Yardage book HTML template (server-side)
- [ ] Chunk 4: PDF export in mobile app
- [x] Chunk 5: Practice round caddie notes
- [x] Chunk 6: Competition on-course mode (Rule 4.3 compliant UI)

### Feature: Add Course CLI — In Progress
- [ ] Chunk 1: Extract shared seed logic + make db:seed idempotent
- [ ] Chunk 2: seed-one-course CLI script

### Feature: Voice Caddie + Scan-First Hole Cards — Complete
- [x] Chunk 1: Prompt schema — add aim_point, carry_target, play_bullets, terrain_note
- [x] Chunk 2: HoleCard visual redesign — scan-first layout
- [x] Chunk 3: Voice readout — one-tap audio caddie

---

## Feature: Add Course CLI

**Created:** 2026-03-21
**Status:** In Progress
**Estimated effort:** ~15 min total

**Goal:** Add any new course to the database with a single npm command — no boilerplate script needed.

**Problem:** Every new course currently requires either copy-pasting `seed-classic-club.ts` (boilerplate for each course) or editing `seed-courses.ts` (which re-runs all 21 courses and crashes on existing slugs due to no conflict handling). Neither is ergonomic.

**In scope:**
- Extract shared seeding logic (prompt, types, `seedCourse()` function) to a shared util
- Make `db:seed` idempotent — skip existing slugs instead of crashing
- A `seed-one-course.ts` CLI script + `db:add-course` npm script

**Out of scope:**
- Admin UI for course management
- Automatic geocoding from address (lat/lng are optional, default to 0 if omitted — weather uses fallback)
- Bulk import from external golf APIs

**Dependencies:** `ANTHROPIC_API_KEY`, `DATABASE_URL` in `.env`

---

### Chunk 1: Extract shared seed logic + make db:seed idempotent
**Estimated effort:** ~10 min
**Files to modify:**
- `apps/api/src/scripts/seed-utils.ts` (new)
- `apps/api/src/scripts/seed-courses.ts`
- `apps/api/src/scripts/seed-classic-club.ts`

**Depends on:** none

**What to do:**

1. Create `apps/api/src/scripts/seed-utils.ts` with:
   - The shared `COURSE_INTEL_PROMPT` string (move from `seed-courses.ts`)
   - The `SeedCourseData` interface (move from `seed-courses.ts`)
   - A `slugify(name: string): string` helper: `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`
   - An exported `seedCourse(courseInfo: { name, slug, city, state, zip, lat, lng })` async function that:
     a. Checks if a course with that slug already exists — if so, logs `→ skipped (already exists)` and returns
     b. Calls Claude with `COURSE_INTEL_PROMPT`
     c. Parses the JSON response
     d. Inserts into `courses` table, then inserts all 18 holes

2. Update `apps/api/src/scripts/seed-courses.ts` to:
   - Remove the local `COURSE_INTEL_PROMPT`, `SeedCourseData`, and `seedCourse()` definitions
   - Import `seedCourse` from `./seed-utils`
   - Keep the `LA_COURSES` list and the `main()` loop unchanged

3. Simplify `apps/api/src/scripts/seed-classic-club.ts` to:
   - Import `seedCourse` from `./seed-utils`
   - Call `seedCourse({ name: 'Classic Club', slug: 'classic-club', city: 'Palm Desert', state: 'CA', zip: '92211', lat: 33.7379, lng: -116.3508 })`
   - Remove all the duplicated boilerplate

**Acceptance criteria:**
- [ ] `npm run db:seed` runs without crashing when some courses already exist (skips them)
- [ ] `seed-classic-club.ts` is reduced to ~10 lines (just imports + one function call)
- [ ] TypeScript compiles without errors

**Key decisions:**
- Use a `select` check before insert (not `onConflictDoNothing`) — this gives a clear "already exists" log message rather than silent no-op, which is helpful when debugging seeding issues

---

### Chunk 2: seed-one-course CLI script
**Estimated effort:** ~5 min
**Files to modify:**
- `apps/api/src/scripts/seed-one-course.ts` (new)
- `apps/api/package.json`

**Depends on:** Chunk 1

**What to do:**

1. Create `apps/api/src/scripts/seed-one-course.ts`:
   - Parse CLI args from `process.argv` — support `--name`, `--city`, `--state`, `--zip`, `--lat` (optional), `--lng` (optional)
   - Auto-derive `slug` from `name` using the `slugify()` helper from `seed-utils`
   - Validate that `--name`, `--city`, `--state`, `--zip` are all provided — print usage and exit if not
   - Call `seedCourse()` from `seed-utils`
   - `process.exit(0)` on success, `process.exit(1)` on error

   Example usage:
   ```
   npm run db:add-course -- --name "Pebble Beach Golf Links" --city "Pebble Beach" --state CA --zip 93953 --lat 36.5684 --lng -121.9476
   ```
   Minimal usage (no lat/lng — weather will use fallback):
   ```
   npm run db:add-course -- --name "Riviera Country Club" --city "Pacific Palisades" --state CA --zip 90272
   ```

2. Add to `apps/api/package.json` scripts:
   ```json
   "db:add-course": "tsx --env-file=.env src/scripts/seed-one-course.ts"
   ```

**Acceptance criteria:**
- [ ] `npm run db:add-course -- --name "..." --city "..." --state CA --zip 12345` adds a new course to the DB and logs success
- [ ] Running it again for the same course prints "already exists" and exits cleanly (no crash)
- [ ] Missing required args prints a usage message and exits with code 1
- [ ] TypeScript compiles without errors

---

**Risks & Unknowns:**
- Claude's knowledge of obscure/newer courses may be incomplete — the seed data quality depends on how well Claude knows the course. For very private or obscure clubs, the hole-by-hole intel may be generic. No mitigation planned (acceptable for MVP).
- lat/lng defaulting to 0 means weather fetches for courses without coordinates will return data for a point in the ocean off Africa — the fetch will succeed but the data will be wrong. The playbook still works because weather failure is non-fatal. Add a console warning in `seedCourse` when lat/lng are 0 so the operator knows to update them.

---

## Feature: Voice Caddie + Scan-First Hole Cards

**Created:** 2026-03-21
**Status:** Complete
**Estimated effort:** ~35 min total

**Goal:** Make the playbook usable mid-round with zero reading — scannable visual cards with a specific aim point + one-tap audio caddie.

**Problem 1 (UX):** Current HoleCard has 5 text blocks including a 2-3 sentence strategy paragraph. Too much to parse while standing on the tee box. Players want a specific aim landmark and 3 big bullet points — not a paragraph.

**Problem 2 (Data quality):** The current prompt has no dedicated field for terrain/elevation hazards. Hidden valleys, drops, and false edges don't get called out even when `holeIntel.elevationChange` data exists. This caused a penalty stroke at Trump hole 10.

**In scope:**
- New structured output fields in the Claude prompt (aim_point, carry_target, play_bullets, terrain_note)
- Visual HoleCard redesign: aim point as hero text, 3 big bullets, terrain warning banner
- Voice readout via expo-speech: one-tap button reads the hole strategy aloud
- Stop speech when navigating between holes

**Out of scope:**
- ElevenLabs or other premium TTS (expo-speech is the MVP; can upgrade later)
- Illustrations or hole diagrams
- Auto-play (user must tap to trigger voice)
- Retroactive regeneration of cached playbooks (old playbooks fall back gracefully)

**Dependencies:**
- `expo-speech` package (install via `npx expo install expo-speech`)
- No new API keys required

---

### Chunk 1: Prompt schema — add aim_point, carry_target, play_bullets, terrain_note
**Estimated effort:** ~10 min
**Files to modify:**
- `apps/api/src/lib/prompts.ts`
- `apps/api/src/db/schema.ts`
- `apps/mobile/lib/api.ts`
- `apps/api/src/routes/playbook.ts`

**Depends on:** none

**What to do:**

1. In `apps/api/src/lib/prompts.ts`, update `CADDIE_SYSTEM_PROMPT`:
   - In the holes JSON schema, add 4 new fields after `tee_club`:
     - `"aim_point"`: `"specific visual landmark to aim at off the tee (e.g., 'left edge of right fairway bunker', 'oak tree right of center')"`
     - `"carry_target"`: `"exact carry yardage needed to reach the intended landing zone (not the full hole distance)"`
     - `"play_bullets"`: `"array of exactly 3 strings, each ≤ 12 words. [0] tee shot instruction, [1] approach/layup, [2] scoring mindset"`
     - `"terrain_note"`: `"any hidden terrain between tee and landing zone — valleys, elevation drops, false edges. Empty string if none."`
   - Remove `"strategy"` from the required schema (but keep it as optional fallback — don't break old callers)
   - Add a CRITICAL RULE: `"TERRAIN: If holeIntel contains an elevationChange, always surface any hidden drops, valleys, or false edges in terrain_note. Recreational golfers can't see these — a penalty stroke here is the most costly mistake you can cause."`
   - Add a CRITICAL RULE: `"AIM POINT: Always give a specific visual landmark, not a vague direction. 'Left center fairway' is bad. 'Left edge of the right fairway bunker' is good."`

2. In `apps/api/src/routes/playbook.ts`, bump `max_tokens` from 4000 to 6000 (more fields × 18 holes needs more budget).

3. In `apps/api/src/db/schema.ts`, update the `HoleStrategy` interface to add the 4 new fields as optional (so old cached playbooks don't break):
   ```
   aim_point?: string;
   carry_target?: number;
   play_bullets?: string[];
   terrain_note?: string;
   ```

4. In `apps/mobile/lib/api.ts`, mirror the same optional additions to the `HoleStrategy` interface.

**Acceptance criteria:**
- [ ] Generating a new playbook produces JSON with aim_point, carry_target, play_bullets (array of 3), and terrain_note on every hole
- [x] Generating a new playbook produces JSON with aim_point, carry_target, play_bullets (array of 3), and terrain_note on every hole
- [x] TypeScript compiles without errors in both apps
- [x] Old cached playbooks (missing new fields) still parse correctly — new fields are optional in both TS interfaces

**Key decisions:**
- Keep `strategy` in the prompt schema as optional rather than removing it entirely — existing cached playbooks have it and the UI currently renders it as a fallback. Remove it from the prompt output once Chunk 2 is live and old caches expire naturally.

---

### Chunk 2: HoleCard visual redesign — scan-first layout
**Estimated effort:** ~15 min
**Files to modify:**
- `apps/mobile/components/playbook/HoleCard.tsx`

**Depends on:** Chunk 1

**What to do:**

1. Remove the "Game Plan" strategy paragraph section (lines 103-107 in current HoleCard).
2. Remove the "Scoring Mindset" section (lines 177-180) — this moves into play_bullets[2].
3. After the tee club row, add an **Aim Point hero section**:
   - Label: "AIM HERE" in small caps gold text
   - Value: `hole.aim_point` in large bold white text (text-2xl or text-3xl)
   - If `aim_point` is missing (old playbook), skip this section
4. After aim point, add a **Carry Target row** (only if `carry_target` is present):
   - Left: "CARRY" label in small caps
   - Right: `{hole.carry_target} yds` in large gold text
5. If `terrain_note` is non-empty, add a **Terrain Warning banner** before the Danger section:
   - Amber/orange background (distinct from the red danger section)
   - Icon: ⛰️ or 🏔️
   - Label: "TERRAIN" in small caps
   - Text: `hole.terrain_note`
6. Replace the strategy paragraph with **Play Bullets section**:
   - If `play_bullets` exists: render 3 numbered items, each in large readable text (text-lg), with generous line-height
   - If `play_bullets` is missing (old playbook): render `hole.strategy` as a single item for backward compatibility
7. Keep in place (no change needed): tee club row, target box, danger box, miss buttons, score entry

**Visual hierarchy on the redesigned card (top to bottom):**
- Header (hole #, yardage, par)
- Tee club
- AIM HERE (hero)
- CARRY TARGET
- PLAY BULLETS (1, 2, 3)
- TERRAIN warning (if present)
- DANGER
- Miss buttons
- Score entry

**Acceptance criteria:**
- [ ] Card shows aim_point as the dominant visual element after the club selection
- [ ] 3 play bullets are large and easy to scan — no paragraph walls of text
- [ ] Terrain note renders as a distinct amber/orange banner (visually different from the red DANGER section)
- [ ] Old playbooks without new fields still render cleanly (fallback to strategy paragraph)
- [ ] Scoring mindset is gone as a separate section

---

### Chunk 3: Voice readout — one-tap audio caddie
**Estimated effort:** ~10 min
**Files to modify:**
- `apps/mobile/components/playbook/HoleCard.tsx`
- `apps/mobile/app/round/playbook.tsx`

**Depends on:** Chunk 2

**What to do:**

1. Install expo-speech: `npx expo install expo-speech`

2. In `HoleCard.tsx`:
   - Import `* as Speech from 'expo-speech'`
   - Add `isSpeaking` boolean state
   - Build voice script from structured fields:
     ```
     "Hole {hole_number}. Par {par}. {yardage} yards.
      Take your {tee_club}. Aim at {aim_point}.
      Carry {carry_target} yards to the landing zone.
      {play_bullets[0]}. {play_bullets[1]}. {play_bullets[2]}.
      [if terrain_note]: Terrain warning: {terrain_note}.
      Danger: {danger}."
     ```
     Fall back to `strategy` if `play_bullets` is missing.
   - Add a play/stop button in the header row (top right corner of the card):
     - When not speaking: 🔊 icon, tapping triggers `Speech.speak(script, { rate: 0.9 })`
     - When speaking: ⏹ icon, tapping triggers `Speech.stop()`
   - Use `Speech.isSpeakingAsync()` or the `onDone` callback to reset `isSpeaking` state when speech finishes naturally
   - Export a `stopSpeech` function or expose a ref so the parent can stop speech on hole change

3. In `playbook.tsx`:
   - Add a `useEffect` that watches `currentHole` — when it changes, call `Speech.stop()` to stop any in-progress audio
   - This ensures audio from hole 3 doesn't keep playing when the user taps to hole 4

**Acceptance criteria:**
- [ ] Tapping the speaker icon reads the full hole strategy aloud
- [ ] Tapping again (or the stop icon) stops speech immediately
- [ ] Switching holes stops any in-progress speech
- [ ] Voice script includes aim point, carry target, and terrain note when present
- [ ] Falls back gracefully if expo-speech is unavailable (button just doesn't appear or is disabled)

---

**Risks & Unknowns:**
- `expo-speech` voice quality is robotic (iOS TTS). Acceptable for MVP. ElevenLabs upgrade would require a new API key and server-side audio generation — can plan separately.
- Old cached playbooks (generated before Chunk 1) won't have new fields. Graceful fallbacks in Chunks 2-3 handle this. Playbooks expire naturally per round date, so old ones clear quickly.
- `holeIntel.elevationChange` already exists in the DB schema — this is the data source for `terrain_note`. Claude needs to read it and surface it. The new CRITICAL RULE in the prompt handles this, but worth testing on a known-hilly course like Trump to verify it catches the Trump 10 valley case.
- Token budget: 18 holes × ~4 new fields = more output. 6000 max_tokens should be sufficient, but watch for truncation in testing.

---

## Feature: Competitive Mode

**Created:** 2026-03-21
**Status:** Pending
**Estimated effort:** ~6 sessions total

**Goal:** Make AI Caddie genuinely useful for junior competitive golf — before, during, and after a tournament round. Deliver personalized, player-specific intelligence through the only formats that survive tour phone policies: a printed yardage book and a competition-compliant stripped-down on-course view.

**Context:**
- FCG, SCPGA/JDT: phones banned on course entirely. Paper is the only delivery path.
- AJGA: phone required for scoring (Golf Genius) but Rule 4.3 prohibits club recommendations/strategy advice mid-round.
- US Kids Golf: GPS yardage apps explicitly permitted. Caddies allowed for older divisions.
- USGA Rule 4.3: club recommendations and strategy advice from an app are prohibited during a competitive round. Distance information is permitted.
- The product's value for competition is a pre-round prep tool and printed yardage book, not a live on-course advisor.

**What "personalized" means for this feature:**
Every line of the yardage book is specific to THIS player's bag, THIS player's miss, THIS player's goal, and TODAY's weather. It is not a generic pro-shop yardage book. A 14-handicap slicer gets a different yardage book than a 6-handicap drawer playing the same course.

**In scope:**
- Any-course playbook generation via plain-text course description (unblocks all competition venues)
- Print-optimized prompt fields: do_this, dont_do, approach_club, approach_distance
- Personalized yardage book HTML generated server-side
- PDF export via expo-print in the mobile app
- Per-hole caddie notes captured during a practice round, injected into the playbook prompt
- Competition on-course mode: stripped UI that hides strategy/club advice by default (Rule 4.3 compliant)

**Out of scope:**
- GPS distance to green (requires per-hole green coordinates not in DB — planned separately)
- Match play scoring mode
- Green contour maps or hole diagrams
- ElevenLabs premium voice for competition

**Dependencies:**
- `expo-print` (install via `npx expo install expo-print`)
- No new API keys required
- No new infrastructure — HTML generation is server-side template literals, no puppeteer

---

### Chunk 1: Any-Course Playbook via Text Description
**Estimated effort:** ~2 sessions
**Files to modify:**
- `apps/api/src/lib/prompts.ts` (new function: `buildCustomCoursePrompt`)
- `apps/api/src/routes/playbook.ts` (new route: `POST /playbook/generate-from-description`)
- `apps/mobile/lib/api.ts` (new function: `generatePlaybookFromDescription`)
- `apps/mobile/app/round/custom-course.tsx` (new screen)
- `apps/mobile/app/round/course-select.tsx` (add "Enter course manually" option)

**Depends on:** none

**Problem:** The app only has 20 LA courses. Any competition outside that set is completely inaccessible. A caddie who walked the practice round can describe the course in plain text. Claude can turn that into a full playbook.

**What to do:**

1. In `apps/api/src/lib/prompts.ts`, add a new exported function `buildCustomCoursePrompt`:
   - Same signature as `buildPlaybookPrompt` but replaces the DB hole data with a `courseDescription: string` parameter
   - The prompt section for hole-by-hole data becomes:
     ```
     COURSE DESCRIPTION (provided by caddie):
     {courseDescription}

     Generate a playbook for each hole described. If the caddie described all 18 holes,
     produce 18 strategies. If fewer, produce strategies for the holes described and
     use your knowledge of the course to fill gaps.
     ```
   - Player profile, clubs, weather, and scoring goal sections are identical to the standard prompt
   - Include this instruction: "The caddie may have described holes informally — extract par, yardage, and hazards from context. Ask for nothing. Work with what you have."

2. In `apps/api/src/routes/playbook.ts`, add a new route `POST /playbook/generate-from-description`:
   - Schema: `{ courseName, teeName, courseDescription, roundDate, teeTime, scoringGoal, city?, state? }`
   - `courseName` and `teeName` are free-text strings (not UUIDs — this course isn't in the DB)
   - Fetch weather using the course city/state via a geocoding fallback (or skip weather gracefully if no lat/lng — same non-fatal pattern as existing weather fetch)
   - Call Claude with `buildCustomCoursePrompt`
   - Save playbook to DB with `courseId = null` (the `courseId` column must allow null — verify schema)
   - Return the same `Playbook` shape so the mobile client needs no special handling

3. In `apps/mobile/lib/api.ts`, add:
   ```ts
   export interface GeneratePlaybookFromDescriptionParams {
     courseName: string;
     teeName: string;
     courseDescription: string;
     roundDate: string;
     teeTime: string;
     scoringGoal: string;
     city?: string;
     state?: string;
   }
   export async function generatePlaybookFromDescription(
     params: GeneratePlaybookFromDescriptionParams
   ): Promise<Playbook> {
     return api.post<Playbook>('/playbook/generate-from-description', params);
   }
   ```

4. Create `apps/mobile/app/round/custom-course.tsx`:
   - Header: "Describe the Course"
   - Subheader: "Walk each hole or paste the scorecard. The more you write, the sharper your playbook."
   - Inputs:
     - Course name (text input)
     - City, State (two short text inputs, side by side)
     - Tee name (text input, placeholder "White, Blue, Red...")
     - Course description (multiline TextInput, at least 8 lines, placeholder: "Hole 1: Par 4, 385 yards. Dogleg right at 210 yards. OB left the entire hole. Fairway bunker right at 220. Small elevated green, slopes front to back...")
   - "Continue to Details" button → push to `/round/details` with course/tee stored in roundStore
   - Add a `setCustomCourse(name, tee, description, city, state)` action to roundStore that stores these for the generate call

5. In `apps/mobile/app/round/course-select.tsx`:
   - Below the search results FlatList, add a pressable row: "Playing a course not listed? Enter it manually →"
   - Tapping navigates to `/round/custom-course`

6. In `apps/mobile/app/round/details.tsx`, update `handleGenerate`:
   - Check `roundStore.isCustomCourse` flag
   - If true: call `generatePlaybookFromDescription` with the stored description
   - If false: existing `generatePlaybook` call (no change)

**Acceptance criteria:**
- [ ] A caddie can type a course description and generate a full 18-hole playbook
- [ ] The playbook renders identically to a DB-sourced playbook — same HoleCard, same voice, same scoring
- [ ] "Enter course manually" is discoverable from the course select screen
- [ ] If only 9 holes are described, Claude generates 9 strategies (no crash)
- [ ] TypeScript compiles without errors

**Key decisions:**
- No caching for custom-course playbooks on the same key as DB playbooks — they use `courseId = null` so the cache check won't match. Each generation is fresh. This is acceptable since the caddie's notes may change between practice round and competition day.
- Do not create a DB course record for the described course — this keeps the schema clean and avoids polluting the curated course list with player-entered data.

---

### Chunk 2: Add Print-Optimized Fields to Prompt Schema
**Estimated effort:** ~1 session
**Files to modify:**
- `apps/api/src/lib/prompts.ts`
- `apps/api/src/db/schema.ts`
- `apps/mobile/lib/api.ts`

**Depends on:** none (can run in parallel with Chunk 1)

**Problem:** The current `HoleStrategy` fields are designed for a screen with room to scroll. A yardage book needs terse, directive, player-specific do/don't instructions that reference the player's miss by name. These don't exist today.

**What to do:**

1. In `apps/api/src/lib/prompts.ts`, add 4 new fields to the per-hole JSON schema in `CADDIE_SYSTEM_PROMPT`:

   ```json
   "do_this": [
     "imperative instruction ≤ 12 words — name the specific club",
     "second do ≤ 12 words — reference player shot shape if relevant",
     "optional third do — scoring mindset for this hole"
   ],
   "dont_do": [
     "imperative don't ≤ 14 words — must name the specific danger AND reference player's primary miss",
     "optional second don't — second biggest mistake on this hole"
   ],
   "approach_club": "club name from player's bag for the expected approach shot",
   "approach_distance": 145
   ```

   Add these CRITICAL RULES to `CADDIE_SYSTEM_PROMPT`:
   - `"DO_THIS: Each item must be imperative. Name the club. Reference the player's shot shape where it matters. No passive voice. 'Take 3-hybrid, your fade lands you right-center' not 'Consider using hybrid'."`
   - `"DONT_DO: Each item must name the SPECIFIC consequence. Always reference the player's primary miss if it's relevant to the danger. 'No driver — your slice goes OB left' not 'Be careful with driver'. Maximum 2 items."`
   - `"APPROACH_CLUB: Pick from the player's bag. Calculate remaining distance after the tee shot lands in the intended zone. This is the club they'll actually have in their hands."`

2. In `apps/api/src/db/schema.ts`, add to the `HoleStrategy` interface:
   ```ts
   do_this?: string[];
   dont_do?: string[];
   approach_club?: string;
   approach_distance?: number;
   ```

3. In `apps/mobile/lib/api.ts`, mirror the same optional additions to `HoleStrategy`.

4. Bump `max_tokens` in `apps/api/src/routes/playbook.ts` from 6000 to 8000 to accommodate the additional fields across 18 holes.

**Acceptance criteria:**
- [x] New playbooks include `do_this` (2-3 items), `dont_do` (1-2 items), `approach_club`, `approach_distance` on every hole
- [x] Each `dont_do` item references the player's primary miss when that miss is relevant to the hole's danger
- [x] Old cached playbooks (missing new fields) still parse correctly — all new fields are optional
- [x] TypeScript compiles without errors in both `apps/api` and `apps/mobile`

---

### Chunk 3: Yardage Book HTML Template (Server-Side)
**Estimated effort:** ~2 sessions
**Files to modify:**
- `apps/api/src/lib/yardage-book.ts` (new)
- `apps/api/src/routes/playbook.ts` (new route: `GET /playbook/:id/yardage-book`)

**Depends on:** Chunk 2 (needs do_this, dont_do fields)

**Problem:** The yardage book must be personalized to one player's bag, miss, and goals — not a generic pro-shop layout. It needs to be readable in sunlight, foldable to pocket size, and surveyable in 30 seconds per hole.

**What to do:**

1. Create `apps/api/src/lib/yardage-book.ts` with a single exported function:
   ```ts
   export function generateYardageBookHtml(
     playbook: Playbook,
     profile: PlayerProfile,
     clubs: PlayerClub[],
     course: CourseDetail | { name: string; par: number }
   ): string
   ```
   Returns a complete self-contained HTML string with inline CSS (no external deps).

   **HTML structure:**
   - `<head>` with `@page { size: 5.5in 4.25in; margin: 0.3in; }` for half-letter landscape printing
   - `@media print { body { font-family: 'Georgia', serif; } }` — serif prints well at small sizes
   - Color scheme: dark green background (`#1a2e1a`), gold text (`#d4a843`), white body text — matches app brand and reads well outdoors
   - Page breaks between holes: `page-break-after: always` on each hole section

   **Page 1 — Cover:**
   ```
   AI CADDIE                          [small tracking-wide uppercase]
   ─────────────────────────────────
   {profile.displayName}  ·  HCP {profile.handicap}
   {course.name}  ·  {playbook.teeName} Tees
   {playbook.roundDate}  ·  {playbook.teeTime}

   WEATHER TODAY
   {temp}°F  ·  {wind_speed}mph {compass}  ·  {conditions}
   → [1-2 sentence wind note derived from conditions]

   YOUR TARGETS
   Dream {profile.dreamScore}  ·  Goal {profile.goalScore}  ·  Floor {profile.floorScore}

   PRE-ROUND KEYS
   {playbook.preRoundTalk split into bullet points — max 6 lines}

   YOUR BAG
   {top 6 clubs with carry distances, fairway finders marked with star}
   ```

   **Pages 2-19 — One hole per page:**
   ```
   HOLE {n}          PAR {par}  ·  HDCP {handicap_index}  ·  {yardage} YDS
   ────────────────────────────────────────────  [{PAR CHANCE ★} or {BOGEY}]

   TEE
   {tee_club} ({carry_target} carry)
   Aim: {aim_point}

   APPROACH  ~{approach_distance} yds
   {approach_club}
   {target description — 1 line}

   DO THIS                          NOT THIS
   • {do_this[0]}                   • {dont_do[0]}
   • {do_this[1]}                   • {dont_do[1] if exists}
   • {do_this[2] if exists}

   [IF terrain_note non-empty:]
   TERRAIN: {terrain_note}

   DANGER: {danger}

   IF YOU MISS
   Left: {miss_left — first sentence only}
   Right: {miss_right — first sentence only}
   Short: {miss_short — first sentence only}

   ─────────────────────────────────────────────
   {par-1} · {par} · {par+1} · {par+2}
    Birdie  · Par  · Bogey  · Double
   ```

   **Page 20 — Scorecard:**
   ```
   HOLE  PAR  HDCP  TARGET  SCORE
     1    4     5     B
     2    3    11     B
     3    5     1    B★
   ...
   OUT   36         41
    IN   36         42
   TOTAL 72         83    [goal score]

   Bogey budget: 12  ·  Par chances: {parChances}
   Dream: {dreamScore}  Goal: {goalScore}  Floor: {floorScore}
   ```

   **Template details:**
   - All content uses inline styles (no external CSS files) for portability
   - Font sizes: hole number `2.2rem`, club `1.4rem`, body `0.85rem` — readable at pocket size
   - Two-column layout for DO THIS / NOT THIS sections
   - Terrain note section only renders if `terrain_note` is non-empty
   - For holes without new fields (old cached playbooks): fall back to `play_bullets` for do_this, `danger` for dont_do

2. In `apps/api/src/routes/playbook.ts`, add a new route `GET /playbook/:id/yardage-book`:
   - Fetch the playbook by ID (existing logic)
   - Fetch the player profile + clubs (for bag data and personalization)
   - Fetch the course record (for par, name — `courseId` may be null for custom courses, handle gracefully)
   - Call `generateYardageBookHtml(...)`
   - Return `{ data: { html: string } }` as JSON

**Acceptance criteria:**
- [x] `GET /playbook/:id/yardage-book` returns valid HTML that renders correctly in a browser
- [x] Cover page contains player name, handicap, course, date, pre-round talk, and bag summary
- [x] Each hole page contains: tee club + carry, aim point, approach club + distance, do_this (2-3 items), dont_do (1-2 items), terrain note (if present), danger, miss left/right/short (first sentence), score range footer
- [x] dont_do items reference the player's primary miss where relevant (validated in generated content)
- [x] Scorecard back page has all 18 holes with par, HDCP, target score, and scoring goals
- [x] Old playbooks without do_this/dont_do fields render without crashing (fallback to play_bullets/danger)
- [x] HTML renders correctly in Chrome and Safari (the two print engines players will use)

**Key decisions:**
- Return HTML as JSON `{ data: { html } }` rather than `Content-Type: text/html` — consistent with all other API responses, and easier to handle in the mobile client
- No server-side PDF generation (avoids heavy dependencies like puppeteer on Railway). PDF conversion happens client-side via expo-print.
- Self-contained HTML with inline styles — the generated file must be printable with zero external requests, even offline

---

### Chunk 4: PDF Export in Mobile App
**Estimated effort:** ~1 session
**Files to modify:**
- `apps/mobile/package.json` (add expo-print)
- `apps/mobile/lib/api.ts` (new function: `getYardageBookHtml`)
- `apps/mobile/app/round/playbook.tsx` (add Print button)

**Depends on:** Chunk 3

**What to do:**

1. Install expo-print: `npx expo install expo-print expo-sharing`

2. In `apps/mobile/lib/api.ts`, add:
   ```ts
   export async function getYardageBookHtml(playbookId: string): Promise<string> {
     const result = await api.get<{ html: string }>(`/playbook/${playbookId}/yardage-book`);
     return result.html;
   }
   ```

3. In `apps/mobile/app/round/playbook.tsx`:
   - Import `* as Print from 'expo-print'` and `* as Sharing from 'expo-sharing'`
   - Add `isPrinting` boolean state
   - Add a "Print Yardage Book" button below the playbook header stats bar (visible at all times during the round, not just after 18 holes):
     ```tsx
     <Pressable onPress={handlePrintYardageBook} disabled={isPrinting}>
       <Text>Print Yardage Book</Text>
     </Pressable>
     ```
   - `handlePrintYardageBook`:
     ```ts
     const handlePrintYardageBook = async () => {
       setIsPrinting(true);
       try {
         const html = await getYardageBookHtml(playbook.id);
         const { uri } = await Print.printToFileAsync({ html });
         await Sharing.shareAsync(uri, {
           mimeType: 'application/pdf',
           dialogTitle: `${course.name} Yardage Book`,
           UTI: 'com.adobe.pdf',
         });
       } catch (e) {
         Alert.alert('Error', 'Could not generate yardage book. Please try again.');
       } finally {
         setIsPrinting(false);
       }
     };
     ```
   - Button shows "Generating..." with a loading state while `isPrinting` is true

**Acceptance criteria:**
- [ ] "Print Yardage Book" button is visible on the playbook screen
- [ ] Tapping it fetches the HTML, converts to PDF via expo-print, and opens the iOS/Android share sheet
- [ ] User can AirPrint directly to a printer, save to Files, or share to another app
- [ ] Button shows a loading state during generation (PDF conversion takes 1-3 seconds)
- [ ] Error state shown if the API call fails

---

### Chunk 5: Practice Round Caddie Notes
**Estimated effort:** ~1 session
**Files to modify:**
- `apps/mobile/stores/roundStore.ts` (add holeNotes state)
- `apps/mobile/components/playbook/HoleCard.tsx` (add notes input)
- `apps/api/src/db/schema.ts` (add caddieNotes to playbooks table)
- `apps/api/src/routes/playbook.ts` (save/load caddieNotes, inject into prompt)
- `apps/api/src/lib/prompts.ts` (inject per-hole notes into hole data)

**Depends on:** none (can run in parallel with other chunks)

**Problem:** Before a competition, a caddie walks the course and captures observations that aren't in any database: "the valley on 7 makes it play 30 yards longer," "green on 12 is always firm and fast," "left bunker on 3 looks playable but has no exit angle." These notes should feed back into the Claude prompt and appear in the yardage book.

**What to do:**

1. In `apps/mobile/stores/roundStore.ts`:
   - Add `holeNotes: string[]` to state (18 empty strings initially)
   - Add `setHoleNote: (holeIndex: number, note: string) => void` action

2. In `apps/mobile/components/playbook/HoleCard.tsx`:
   - Add `note: string` and `onNote: (note: string) => void` to `HoleCardProps`
   - After the Danger section, add a collapsible "Caddie Note" section:
     - Header row: "CADDIE NOTE" label + expand/collapse toggle
     - When expanded: multiline `TextInput` (3 lines), placeholder "e.g. Valley at 185 plays 20y longer. Green firm, back pin is dead."
     - Saves on blur via `onNote`
     - If `note` has content, show a preview line when collapsed

3. In `apps/mobile/app/round/playbook.tsx`:
   - Pass `note={holeNotes[currentHole]}` and `onNote={(n) => setHoleNote(currentHole, n)}` to `HoleCard`

4. In `apps/api/src/db/schema.ts`, add `caddieNotes: jsonb` to the `playbooks` table (array of 18 strings). Run a migration.

5. In `apps/api/src/routes/playbook.ts`:
   - Add `PATCH /playbook/:id/notes` endpoint: accepts `{ holeIndex: number, note: string }`, updates the `caddieNotes[holeIndex]` in the DB
   - Load `caddieNotes` when returning the playbook from `GET /playbook/:id` and `POST /playbook/generate`

6. In `apps/mobile/lib/api.ts`, add:
   ```ts
   export async function updatePlaybookNote(playbookId: string, holeIndex: number, note: string): Promise<void> {
     await api.patch(`/playbook/${playbookId}/notes`, { holeIndex, note });
   }
   ```
   Call this from `HoleCard`'s `onNote` handler (debounced 800ms to avoid excessive API calls).

7. In `apps/api/src/lib/prompts.ts`, in `buildPlaybookPrompt` and `buildCustomCoursePrompt`:
   - Add `caddieNotes?: string[]` parameter
   - In the hole-by-hole data section, append the note for each hole if it exists:
     ```
     { number: 1, par: 4, yardage: 385, ..., caddieNote: "valley at 185 plays 20y longer" }
     ```

**Acceptance criteria:**
- [x] A collapsible notes field appears on each hole card
- [x] Notes persist across app sessions (saved to API)
- [x] Notes inject into the playbook prompt when regenerating (visible in Claude's output — e.g., "caddie notes a hidden valley at 185 that plays 20 yards longer")
- [ ] Notes appear in the yardage book PDF (added to the hole page in a CADDIE NOTES section)
- [x] TypeScript compiles without errors

---

### Chunk 6: Competition On-Course Mode (Rule 4.3 Compliant UI)
**Estimated effort:** ~1 session
**Files to modify:**
- `apps/mobile/stores/roundStore.ts` (add isCompetitionMode flag)
- `apps/mobile/app/round/details.tsx` (add competition mode toggle)
- `apps/mobile/components/playbook/HoleCard.tsx` (conditional rendering based on mode)
- `apps/mobile/app/round/playbook.tsx` (pass isCompetitionMode, show compliance badge)

**Depends on:** none (can run in parallel)

**Context:** Under USGA Rule 4.3, club recommendations and strategy advice from an app are prohibited during a competitive round. Violation = 2 strokes first breach, DQ on second. This mode makes the app legally safe to use on-course at AJGA and US Kids Golf events where phones are permitted.

**What to do:**

1. In `apps/mobile/stores/roundStore.ts`:
   - Add `isCompetitionMode: boolean` to state (default `false`)
   - Add `setCompetitionMode: (v: boolean) => void` action

2. In `apps/mobile/app/round/details.tsx`:
   - Below the scoring goal chips, add a toggle row:
     ```
     Competition Round
     [toggle switch]
     Rule 4.3: club advice hidden by default on course.
     Study your playbook now — print it before you play.
     ```
   - Tapping it calls `setCompetitionMode(true/false)` in roundStore

3. In `apps/mobile/components/playbook/HoleCard.tsx`:
   - Add `isCompetitionMode?: boolean` to `HoleCardProps`
   - When `isCompetitionMode` is true, the card renders in "Competition View":
     - Shows: hole header (number, par, yardage, HDCP), tee club badge, aim point, score entry
     - Hides by default: play bullets, approach club, terrain note, danger, miss buttons, do_this/dont_do
     - Adds a single "Show Strategy" pressable button that reveals the hidden sections when tapped (with a brief warning: "Showing strategy may breach Rule 4.3 in competition")
     - "Show Strategy" state resets when navigating to a new hole (back to hidden)
   - When `isCompetitionMode` is false: renders exactly as today (no change)

4. In `apps/mobile/app/round/playbook.tsx`:
   - Read `isCompetitionMode` from roundStore
   - Pass it to `HoleCard`
   - When competition mode is active, show a persistent gold badge below the header: "COMPETITION MODE · Rule 4.3 Active"

**Acceptance criteria:**
- [x] Competition mode toggle is available in round details setup
- [x] When active, HoleCard shows only hole info + tee club + aim point + score entry by default
- [x] "Show Strategy" button reveals full strategy with a Rule 4.3 warning
- [x] "Show Strategy" state resets when navigating between holes
- [x] A "COMPETITION MODE" badge is visible on the playbook screen
- [x] Normal mode is completely unchanged

---

**Risks & Unknowns:**
- Custom course playbooks (`courseId = null`): Verify the `playbooks` table schema allows nullable `courseId`. If there's a NOT NULL constraint, add a migration to relax it.
- Yardage book print quality depends on the iOS/Android WebView rendering of the HTML. Test on device — not just simulator — because font rendering and page breaks behave differently.
- The `do_this`/`dont_do` personalization quality depends on how well Claude reads the player's miss tendencies from the profile. Test with a real profile (primary miss = "Slice right") and verify that at least 3-4 holes have a `dont_do` that explicitly names the slice.
- `expo-print` has known issues with large HTML files on older Android devices. If a 20-page yardage book causes memory issues, split into front-9 and back-9 PDFs as a fallback.
- Practice round notes (Chunk 5) require a DB migration for `caddieNotes` column. Run `npm run db:migrate` in the Railway environment after deploying Chunk 5.
- Competition mode (Chunk 6) does not provide GPS distance to green — that requires per-hole green coordinates which are not in the current schema. This is explicitly deferred. The mode is about UI compliance, not GPS yardage.
