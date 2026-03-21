import type { TeeInfo, CourseIntel, HoleIntel } from '../db/schema';

export const CADDIE_SYSTEM_PROMPT = `You are an expert golf caddie AI. Create a tight, personalized hole-by-hole strategy playbook.

Rules:
- Clubs: only use clubs the player has. Carry distance = what matters.
- Bogey-first: bogey is the baseline, par is a bonus.
- Miss pattern drives every club/aim decision.
- Headwind = 1 extra club per 10mph. Tailwind = minor effect.
- Fairway finder clubs → prefer off tight tees.
- aim_point: a specific visual landmark (e.g. "left edge of right bunker"). Never vague.
- Be terse. Every field has a hard word limit — stay under it.

Return ONLY valid JSON (no markdown, no backticks):
{
  "pre_round_talk": "2 sentences max. Key theme + one specific tip.",
  "projected_score": number,
  "driver_holes": [hole numbers],
  "par_chance_holes": [hole numbers],
  "holes": [
    {
      "hole_number": 1,
      "yardage": 309,
      "par": 4,
      "tee_club": "3-Hybrid",
      "aim_point": "≤8 words — specific landmark",
      "carry_target": 160,
      "play_bullets": [
        "≤10 words — tee shot with club name",
        "≤10 words — approach or scoring note"
      ],
      "terrain_note": "≤10 words — hidden drop or valley. Empty string if flat.",
      "miss_left": "≤8 words — one recovery action",
      "miss_right": "≤8 words — one recovery action",
      "miss_short": "≤8 words — one recovery action",
      "danger": "≤10 words — the one thing to avoid",
      "target": "Par" or "Bogey",
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
  scoringGoal: string,
  caddieNotes?: string[]
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
    .map((h) => {
      const note = caddieNotes?.[h.holeNumber - 1];
      return {
        number: h.holeNumber,
        par: h.par,
        yardage: (h.yardages as Record<string, number>)[teeName],
        handicap: h.handicapIndex,
        intel: h.holeIntel,
        ...(note ? { caddieNote: note } : {}),
      };
    });

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

export function buildCustomCoursePrompt(
  profile: PlayerWithClubs,
  courseName: string,
  teeName: string,
  weather: WeatherData,
  scoringGoal: string,
  courseDescription: string,
  caddieNotes?: string[]
): string {
  const clubs = profile.clubs
    .sort((a, b) => (b.carryDistance || 0) - (a.carryDistance || 0))
    .map(
      (c) =>
        `${c.clubName}: ${c.carryDistance} yds carry` +
        (c.isFairwayFinder ? ' \u2605 FAIRWAY FINDER' : '')
    )
    .join('\n');

  const windDeg = weather?.wind_deg ?? 0;
  const windSpeed = weather?.wind_speed ?? 0;
  const temp = weather?.temp ?? 72;
  const conditions = weather?.weather?.[0]?.description ?? 'clear';
  const compass = degreesToCompass(windDeg);

  const notesSection = caddieNotes?.some((n) => n)
    ? `\nCADDIE NOTES (from practice round):\n${caddieNotes
        .map((n, i) => (n ? `Hole ${i + 1}: ${n}` : ''))
        .filter(Boolean)
        .join('\n')}`
    : '';

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

COURSE: ${courseName}
TEE: ${teeName}

WEATHER AT TEE TIME:
- Temperature: ${Math.round(temp)}\u00B0F
- Wind: ${Math.round(windSpeed)} mph from ${compass} (${windDeg}\u00B0)
- Conditions: ${conditions}

COURSE DESCRIPTION (provided by caddie):
${courseDescription}
${notesSection}

Generate a playbook for each hole described. If the caddie described all 18 holes, produce 18 strategies. If fewer, produce strategies for the holes described and use your knowledge of the course to fill gaps. The caddie may have described holes informally — extract par, yardage, and hazards from context. Ask for nothing. Work with what you have.

Generate a personalized playbook for this player on this course today.`;
}

function degreesToCompass(deg: number): string {
  const dirs = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}
