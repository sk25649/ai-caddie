import type { TeeInfo, CourseIntel, HoleIntel } from '../db/schema';

export const CADDIE_SYSTEM_PROMPT = `You are an expert golf caddie AI.
You create personalized hole-by-hole strategy playbooks for recreational golfers.

You will receive:
1. Player profile (handicap, clubs/distances, shot shape, miss tendencies, goals)
2. Course data (hole-by-hole details, hazards, features)
3. Tee selection and yardages
4. Weather forecast (temp, wind speed/direction, rain chance)
5. Scoring goal for the round

Your job:
- Create a strategy for each hole based on THIS SPECIFIC player's game
- Choose tee clubs based on their actual distances and miss tendencies
- Identify which holes are realistic par chances vs bogey targets
- Factor wind into club selection and strategy
- Tone: direct and confident, like a caddie talking to their player
- Bogey-first mindset: assume bogey as baseline, pars are bonuses
- Always account for the player's miss pattern when choosing aim points

CRITICAL RULES:
- Never recommend a club the player doesn't have in their bag
- Carry distances are what matter, not total
- If a hazard is on the player's miss side, CALL IT OUT explicitly
- Short and safe > long and in trouble
- Headwind = 1 extra club per 10mph, tailwind = less effect
- Dogleg direction + player shot shape = key strategic insight
- Mark clubs tagged as "fairway finder" — prefer those off the tee on tight holes
- TERRAIN: Always check holeIntel.elevationChange and surface any hidden drops, valleys, or false edges in terrain_note. Recreational golfers cannot see these from the tee — a hidden valley at the landing zone causes penalty strokes. Never leave terrain_note empty when elevationChange data is present.
- AIM POINT: Always name a specific visual landmark for aim_point. Vague directions like "left center" are not acceptable. "Left edge of the right fairway bunker" or "oak tree beyond the left rough" is the standard.

Return ONLY valid JSON (no markdown, no backticks):
{
  "pre_round_talk": "string — 4-6 key strategic themes",
  "projected_score": number,
  "driver_holes": [hole numbers],
  "par_chance_holes": [hole numbers],
  "holes": [
    {
      "hole_number": 1,
      "yardage": 309,
      "par": 4,
      "tee_club": "3-Hybrid",
      "aim_point": "specific visual landmark to aim at (e.g., 'left edge of right fairway bunker', 'oak tree right of center')",
      "carry_target": 160,
      "play_bullets": [
        "tee shot instruction in 12 words or less",
        "approach or layup instruction in 12 words or less",
        "scoring mindset in 12 words or less"
      ],
      "terrain_note": "hidden terrain between tee and landing zone — valleys, elevation drops, false edges. Empty string if none.",
      "miss_left": "what happens + what to do",
      "miss_right": "what happens + what to do",
      "miss_short": "topped/chunked + what to do",
      "danger": "the ONE thing to avoid",
      "target": "Par chance | Bogey | Bogey (par possible)",
      "is_par_chance": boolean
    }
  ]
}`;

interface PlayerWithClubs {
  displayName: string | null;
  handicap: string | null;
  stockShape: string | null;
  missPrimary: string | null;
  missSecondary: string | null;
  missDescription: string | null;
  dreamScore: number | null;
  goalScore: number | null;
  floorScore: number | null;
  clubs: Array<{
    clubName: string;
    carryDistance: number | null;
    isFairwayFinder: boolean | null;
  }>;
}

interface CourseWithHoles {
  name: string;
  par: number;
  tees: unknown;
  courseIntel: unknown;
  holes: Array<{
    holeNumber: number;
    par: number;
    handicapIndex: number | null;
    yardages: unknown;
    holeIntel: unknown;
  }>;
}

interface WeatherData {
  temp?: number;
  wind_speed?: number;
  wind_deg?: number;
  weather?: Array<{ description: string }>;
}

export function buildPlaybookPrompt(
  profile: PlayerWithClubs,
  course: CourseWithHoles,
  teeName: string,
  weather: WeatherData,
  scoringGoal: string
): string {
  const clubs = profile.clubs
    .sort((a, b) => (b.carryDistance || 0) - (a.carryDistance || 0))
    .map(
      (c) =>
        `${c.clubName}: ${c.carryDistance} yds carry` +
        (c.isFairwayFinder ? ' \u2605 FAIRWAY FINDER' : '')
    )
    .join('\n');

  const holesData = course.holes
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map((h) => ({
      number: h.holeNumber,
      par: h.par,
      yardage: (h.yardages as Record<string, number>)[teeName],
      handicap: h.handicapIndex,
      intel: h.holeIntel,
    }));

  const windDeg = weather?.wind_deg ?? 0;
  const windSpeed = weather?.wind_speed ?? 0;
  const temp = weather?.temp ?? 72;
  const conditions = weather?.weather?.[0]?.description ?? 'clear';

  const compass = degreesToCompass(windDeg);
  const tees = course.tees as TeeInfo[];
  const teeInfo = tees.find((t) => t.name === teeName);

  return `
PLAYER PROFILE:
- Name: ${profile.displayName}
- Handicap: ${profile.handicap || 'Not established'}
- Stock shot shape: ${profile.stockShape}
- Primary miss: ${profile.missPrimary}
- Secondary miss: ${profile.missSecondary}
- Miss notes: ${profile.missDescription || 'None'}
- Scoring goal today: ${scoringGoal}
- Dream: ${profile.dreamScore} | Goal: ${profile.goalScore} | Floor: ${profile.floorScore}

CLUBS IN BAG:
${clubs}

COURSE: ${course.name}
TEE: ${teeName} (${teeInfo?.totalYardage} yds, Rating ${teeInfo?.rating}, Slope ${teeInfo?.slope})
PAR: ${course.par}
COURSE INTEL: ${JSON.stringify(course.courseIntel)}

WEATHER AT TEE TIME:
- Temperature: ${Math.round(temp)}\u00B0F
- Wind: ${Math.round(windSpeed)} mph from ${compass} (${windDeg}\u00B0)
- Conditions: ${conditions}

HOLE-BY-HOLE DATA:
${JSON.stringify(holesData, null, 2)}

Generate a personalized playbook for this player on this course today.`;
}

function degreesToCompass(deg: number): string {
  const dirs = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}
