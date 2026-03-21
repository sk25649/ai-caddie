# Roadmap — AI Caddie

**Last updated:** 2026-03-21 (Chunk 1 complete)

## Progress

### Feature: Voice Caddie + Scan-First Hole Cards — In Progress
- [x] Chunk 1: Prompt schema — add aim_point, carry_target, play_bullets, terrain_note
- [ ] Chunk 2: HoleCard visual redesign — scan-first layout
- [ ] Chunk 3: Voice readout — one-tap audio caddie

---

## Feature: Voice Caddie + Scan-First Hole Cards

**Created:** 2026-03-21
**Status:** In Progress
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
