# Course Memory Feature — Design & Implementation Plan

**Created:** 2026-03-21 06:40 AM  
**Status:** Planning  
**Complexity:** Medium (3-4 implementation sessions)

---

## Purpose

The retention engine. When a player returns to a course, we show:
- What happened last time on each hole
- What worked, what didn't
- Specific adjustments for next round

Example:
```
Hole 7 (Par 4, 385y)
Last time: You made double. Missed right into bunker.

Next time: 
→ 3-wood instead of driver (you always miss right with driver here)
→ Aim left side fairway
→ Approach from 155 yards
```

This compounds retention: players want to come back and apply lessons.

---

## Data Model

### New Table: `course_hole_memory`

Tracks learnings for each (player, course, hole) combo.

```sql
CREATE TABLE course_hole_memory (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES player_profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  hole_number INT NOT NULL (1-18),
  
  -- From prior rounds on this course
  num_visits INT DEFAULT 1,
  last_round_date DATE,
  last_score INT,
  last_score_vs_par INT (-2 to +5),
  
  -- Learning from post-round review (ai-caddie-3)
  best_club_tee VARCHAR,
  worst_decision TEXT,
  successful_strategy TEXT,
  
  -- Derived insight (can be AI-generated or player annotation)
  next_time_guidance TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(profile_id, course_id, hole_number)
);
```

### Enhanced: `round_scores`

Add a `key_learnings` JSONB field to capture per-hole takeaways during post-round review.

```json
{
  "hole_learnings": [
    {
      "hole": 7,
      "decision_mistake": "Took driver instead of 3-wood—always slice right here",
      "what_worked": "Lay-up strategy from round 1 still works",
      "next_adjustment": "Use 3-wood. Accept par, don't go for birdie"
    }
  ]
}
```

---

## Feature Breakdown

### Phase 1: Data Collection (No UI Yet)

**Goal:** Capture learnings from rounds (happens automatically during post-round review from ai-caddie-3).

- During post-round review (after ai-caddie-3 is deployed), extract key decisions:
  - Which holes had doubles? (cost analysis)
  - Which holes had pars on par chances? (what worked)
  - Which holes repeated mistakes from last round? (pattern detection)
  
- Save to `round_scores.key_learnings` as structured JSON

- Optional: Simple API endpoint `POST /courses/:id/hole/:num/learning` to let players add manual notes ("this bunker is impossibly firm", etc.)

**Time estimate:** 30 min  
**Files:** API endpoint only, no UI

---

### Phase 2: Course Memory Calculation

**Goal:** Synthesize learnings into "next time" guidance.

- After each round, trigger a job that:
  1. Reads `key_learnings` from the round
  2. Compares to prior `course_hole_memory` for same player + course + hole
  3. Updates `course_hole_memory` with:
     - `last_score`, `last_score_vs_par`
     - `num_visits` (cumulative)
     - `successful_strategy` (if hole went well)
     - `worst_decision` (if hole had issues)

- AI generates `next_time_guidance` if player returns (uses Claude to synthesize patterns)

**Time estimate:** 1 hour  
**Files:** API endpoint + background job logic

---

### Phase 3: Display on Playbook Screen

**Goal:** Show guidance when player starts a round on a familiar course.

- When generating a playbook for a course player has visited before:
  - Fetch `course_hole_memory` for all 18 holes
  - Prepend to playbook data: `{ ...hole, priorMemory: { numVisits, lastScore, guidance } }`

- UI adds a "Last Time" section above the main hole card (collapsible):
  ```
  LAST TIME (1 round ago)
  ───────────────────────
  Score: 6 (vs Par 4) ← double
  Issue: "Took driver — sliced right into bunker"
  Next time: "Use 3-wood. Lay up to 155 approach."
  
  [Expand details]
  ```

- If player has visited 3+ times, show patterns:
  ```
  HISTORY
  ───────
  Round 1: 6 (double — driver slice)
  Round 2: 5 (bogey — good strategy)
  Round 3: 4 (par — 3-wood worked)
  
  Pattern: 3-wood is best tee choice on this hole.
  ```

**Time estimate:** 45 min  
**Files:** Mobile UI + API response enhancement

---

### Phase 4: "Next Time" Guidance Generation (AI)

**Goal:** Claude synthesizes learnings into actionable next-time advice.

- After round is scored, send this to Claude:
  ```
  Hole 7, Par 4, 385 yards
  Player history: 3 visits
  - Visit 1: 6 (double, "driver slice into right bunker")
  - Visit 2: 5 (bogey, "played lay-up, good strategy, approach from 155")
  - Visit 3: 4 (par, "3-wood to 210, approach 155, made par")
  
  Current playbook tee club: Driver
  
  Generate a one-sentence "next time" tip based on this player's history at this specific hole.
  Example: "3-wood has worked twice—trust the lay-up over driver."
  ```

- Store in `course_hole_memory.next_time_guidance`

**Time estimate:** 20 min (API call + parsing)  
**Files:** Playbook route enhancement

---

## Implementation Roadmap (Phased)

### Chunk 1: Post-Round Learnings Capture (30 min)
- [ ] Add `key_learnings` JSONB field to `round_scores` table
- [ ] During post-round review flow, extract learnings:
  - Holes with doubles (cost 2+ strokes)
  - Holes with pars on par-chance holes
  - Compare to current playbook (did they follow advice or deviate?)
- [ ] Save learnings to `round_scores.key_learnings` before returning round

**Acceptance criteria:**
- Rounds saved include a `key_learnings` JSON structure
- Can query a round and see what decisions were made

---

### Chunk 2: Course Memory Table & Sync (1 hour)
- [ ] Create `course_hole_memory` table
- [ ] Create `POST /rounds/:id/sync-to-memory` endpoint:
  - Takes a saved round, extracts `key_learnings`
  - For each hole, upsert `course_hole_memory` with:
    - `num_visits` incremented
    - `last_score`, `last_score_vs_par` updated
    - `successful_strategy` if score was good (par or better)
    - `worst_decision` if score was bad (double or worse)
- [ ] This endpoint is called after `POST /rounds` succeeds

**Acceptance criteria:**
- Play a round on a course, save it, check DB—`course_hole_memory` table is updated
- Play same course again, `num_visits` increments

---

### Chunk 3: Playbook Enhancement (45 min)
- [ ] When generating a playbook (`POST /playbook/generate`), check if player has prior rounds on this course
- [ ] If so, fetch `course_hole_memory` for each hole
- [ ] Append to `HoleStrategy`: `priorMemory?: { numVisits, lastScore, lastScoreVsPar, successfulStrategy, worstDecision }`
- [ ] Return in playbook response

**Acceptance criteria:**
- Generate playbook for a course player has played—response includes `priorMemory` field
- Mobile can optionally render this data (not required yet)

---

### Chunk 4: "Last Time" UI Display (45 min)
- [ ] In `HoleCard.tsx`, add optional "Last Time" section (collapsible)
- [ ] Shows:
  - Score from last round + vs par
  - Worst decision / best decision
  - Pattern if 3+ visits
- [ ] UI is secondary to main strategy (doesn't clutter)

**Acceptance criteria:**
- Play a hole on repeat course—HoleCard shows "Last Time" section
- Can tap to expand/collapse
- Shows correct data from `priorMemory`

---

### Chunk 5: AI Guidance Generation (20 min)
- [ ] After syncing round to memory, call Claude with prior history + current playbook
- [ ] Generate one-sentence "next time" guidance
- [ ] Save to `course_hole_memory.next_time_guidance`
- [ ] Display in UI (in "Last Time" section or as a callout)

**Acceptance criteria:**
- Guidance is specific to this player's history on this hole
- Appears in UI on next round at same course

---

## Data Flow Diagram

```
Player finishes round (all 18 holes scored)
  ↓
POST /rounds (save round with hole_scores)
  ↓
GET /rounds/:id/review (post-round analysis)
  - Claude analyzes round vs playbook
  - Generates 3 key lessons
  - Extracts decision mistakes and successes
  - Saves to round_scores.key_learnings
  ↓
POST /rounds/:id/sync-to-memory (new endpoint)
  - Reads round + key_learnings
  - Upsets course_hole_memory with latest round data
  - Calls Claude to generate next-time guidance
  ↓
Next time player plays same course:
  - POST /playbook/generate (existing)
  - Includes course_hole_memory in response
  ↓
Mobile displays playbook + "Last Time" section
```

---

## Edge Cases

1. **Player never played this course before**: No `course_hole_memory` — UI gracefully hides "Last Time" section.

2. **Very old rounds (6+ months)**: Still include in history but mark as stale ("6 months ago"). Current conditions may have changed.

3. **Course conditions change** (bunker filled in, hazard relocated): No automation to detect this. Manual update only (out of scope).

4. **Multiple rounds same day**: Both are counted; player sees "1 round ago" or "this morning" (timestamp-based).

5. **Course has no prior rounds**: No course_hole_memory for player. Playbook includes fresh strategy only.

---

## Questions & Decisions

1. **Should we track EVERY round, or just competitive/quality rounds?**
   - Current: Track all. Gives most learning data. Player can ignore casual range rounds if they input separately.

2. **Should prior memory override playbook recommendations?**
   - Current: No. Playbook is gospel. Prior memory is supplementary context. Prevents getting locked into suboptimal strategies.

3. **Should we share memory with other players (course-wide lessons)?**
   - Current: No. Privacy + personalization is the moat. Each player's memory is private.

4. **How many rounds before "patterns" emerge?**
   - Minimum 3 visits to show pattern UI (statistically weak before then).

---

## Success Metrics

- **Retention**: Returning players (2+ rounds same course) should increase 20-30%
- **Engagement**: Time spent on playbook screen before round should increase (reading prior memory)
- **Conversion**: "Next time" guidance should be quoted in post-round reviews (shows value capture)

---

