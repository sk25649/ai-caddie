import { describe, it, expect } from 'vitest';
import { buildPlaybookPrompt, buildCustomCoursePrompt, CADDIE_SYSTEM_PROMPT, mergeDbDataIntoHoles } from '../lib/prompts';

// ── Fixtures ──────────────────────────────────────────────────────────────

const baseProfile = {
  displayName: 'Sam',
  handicap: '18',
  stockShape: 'draw',
  missPrimary: 'High hook left',
  missSecondary: 'Slice right',
  missDescription: 'Worse under pressure',
  dreamScore: 85,
  goalScore: 89,
  floorScore: 99,
  clubs: [
    { clubName: 'Driver', carryDistance: 240, isFairwayFinder: false },
    { clubName: '3-Hybrid', carryDistance: 210, isFairwayFinder: true },
    { clubName: '7-Iron', carryDistance: 160, isFairwayFinder: false },
    { clubName: 'PW', carryDistance: 125, isFairwayFinder: false },
  ],
};

const baseCourse = {
  name: 'Torrey Pines South',
  par: 72,
  tees: [
    { name: 'White', color: '#fff', totalYardage: 6874, rating: 74.6, slope: 138 },
  ],
  courseIntel: { overview: 'Clifftop links', windPatterns: 'Ocean breeze' },
  holes: Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: i < 4 ? 3 : 4,
    handicapIndex: i + 1,
    yardages: { White: 350 + i * 5 },
    holeIntel: { shape: 'straight' },
  })),
};

const baseWeather = {
  temp: 72,
  wind_speed: 10,
  wind_deg: 0,
  weather: [{ description: 'sunny' }],
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('buildPlaybookPrompt — player data', () => {
  it('includes player name', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('Sam');
  });

  it('includes handicap', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('18');
  });

  it('uses "Not established" when handicap is null', () => {
    const profile = { ...baseProfile, handicap: null };
    const prompt = buildPlaybookPrompt(profile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('Not established');
  });

  it('includes stock shot shape', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('draw');
  });

  it('includes primary miss', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('High hook left');
  });

  it('includes scoring goal', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('Break 90');
  });

  it('includes dream/goal/floor scores', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('85');
    expect(prompt).toContain('89');
    expect(prompt).toContain('99');
  });
});

describe('buildPlaybookPrompt — club sorting and fairway finder', () => {
  it('sorts clubs by carry distance descending', () => {
    const profile = {
      ...baseProfile,
      clubs: [
        { clubName: 'PW', carryDistance: 125, isFairwayFinder: false },
        { clubName: 'Driver', carryDistance: 240, isFairwayFinder: false },
        { clubName: '7-Iron', carryDistance: 160, isFairwayFinder: false },
      ],
    };
    const prompt = buildPlaybookPrompt(profile, baseCourse, 'White', baseWeather, 'Break 90');

    const driverPos = prompt.indexOf('Driver: 240');
    const ironPos = prompt.indexOf('7-Iron: 160');
    const pwPos = prompt.indexOf('PW: 125');

    // Driver should appear before 7-Iron, which should appear before PW
    expect(driverPos).toBeLessThan(ironPos);
    expect(ironPos).toBeLessThan(pwPos);
  });

  it('marks fairway finder clubs with ★', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('★ FAIRWAY FINDER');
    // 3-Hybrid is the fairway finder
    expect(prompt).toContain('3-Hybrid: 210 yds carry ★ FAIRWAY FINDER');
  });

  it('does not mark non-fairway-finder clubs with ★', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    // Driver should NOT have the fairway finder mark
    expect(prompt).toContain('Driver: 240 yds carry\n');
  });

  it('handles null carryDistance as 0 for sorting (null in b position)', () => {
    const profile = {
      ...baseProfile,
      clubs: [
        { clubName: 'Putter', carryDistance: null, isFairwayFinder: false },
        { clubName: 'Driver', carryDistance: 240, isFairwayFinder: false },
      ],
    };
    // Should not throw; Putter (null) sorted after Driver (240)
    const prompt = buildPlaybookPrompt(profile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt.indexOf('Driver')).toBeLessThan(prompt.indexOf('Putter'));
  });

  it('handles null carryDistance as 0 for sorting (null in a position)', () => {
    const profile = {
      ...baseProfile,
      clubs: [
        { clubName: 'Driver', carryDistance: 240, isFairwayFinder: false },
        { clubName: 'Putter', carryDistance: null, isFairwayFinder: false },
        { clubName: 'SW', carryDistance: null, isFairwayFinder: false },
      ],
    };
    // Sorting 3 clubs forces V8's sort to compare null-vs-null (a.carryDistance null)
    const prompt = buildPlaybookPrompt(profile, baseCourse, 'White', baseWeather, 'Break 90');
    // Driver should still appear first regardless of Putter/SW order
    expect(prompt.indexOf('Driver')).toBeLessThan(prompt.indexOf('Putter'));
  });

  it('treats null isFairwayFinder as false (no star label)', () => {
    const profile = {
      ...baseProfile,
      clubs: [
        { clubName: '5-Wood', carryDistance: 220, isFairwayFinder: null },
      ],
    };
    const prompt = buildPlaybookPrompt(profile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('5-Wood: 220 yds carry');
    expect(prompt).not.toContain('★ FAIRWAY FINDER');
  });

  it('mutates the input clubs array (known side effect)', () => {
    // This documents the sort() mutation bug — sort() modifies the original array
    const clubs = [
      { clubName: 'PW', carryDistance: 125, isFairwayFinder: false },
      { clubName: 'Driver', carryDistance: 240, isFairwayFinder: false },
    ];
    const profile = { ...baseProfile, clubs };
    const originalFirstClub = clubs[0].clubName;

    buildPlaybookPrompt(profile, baseCourse, 'White', baseWeather, 'Break 90');

    // After calling buildPlaybookPrompt, clubs[0] has changed (sorted)
    // Driver (240) is now first because sort is descending
    expect(clubs[0].clubName).toBe('Driver');
    expect(clubs[0].clubName).not.toBe(originalFirstClub);
  });
});

describe('buildPlaybookPrompt — weather and wind direction', () => {
  const makePromptWithWind = (deg: number) =>
    buildPlaybookPrompt(baseProfile, baseCourse, 'White', { ...baseWeather, wind_deg: deg }, 'Break 90');

  it('converts 0° to N', () => expect(makePromptWithWind(0)).toContain('from N ('));
  it('converts 90° to E', () => expect(makePromptWithWind(90)).toContain('from E ('));
  it('converts 180° to S', () => expect(makePromptWithWind(180)).toContain('from S ('));
  it('converts 270° to W', () => expect(makePromptWithWind(270)).toContain('from W ('));
  it('converts 45° to NE', () => expect(makePromptWithWind(45)).toContain('from NE ('));
  it('converts 315° to NW', () => expect(makePromptWithWind(315)).toContain('from NW ('));
  it('converts 360° back to N', () => expect(makePromptWithWind(360)).toContain('from N ('));

  it('defaults to 72°F when temp is undefined', () => {
    const prompt = buildPlaybookPrompt(
      baseProfile, baseCourse, 'White',
      { wind_speed: 0, wind_deg: 0 }, // no temp
      'Break 90'
    );
    expect(prompt).toContain('72°F');
  });

  it('defaults to "clear" when conditions undefined', () => {
    const prompt = buildPlaybookPrompt(
      baseProfile, baseCourse, 'White',
      { temp: 75, wind_speed: 5, wind_deg: 0 }, // no weather array
      'Break 90'
    );
    expect(prompt).toContain('clear');
  });

  it('includes wind speed in prompt', () => {
    const prompt = buildPlaybookPrompt(
      baseProfile, baseCourse, 'White',
      { ...baseWeather, wind_speed: 15 },
      'Break 90'
    );
    expect(prompt).toContain('15 mph');
  });
});

describe('CADDIE_SYSTEM_PROMPT — structured output schema', () => {
  it('includes aim_point field', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('aim_point');
  });

  it('includes carry_target field', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('carry_target');
  });

  it('includes play_bullets field', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('play_bullets');
  });

  it('includes terrain_note field', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('terrain_note');
  });

  it('includes terrain_note guidance about drops and valleys', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('terrain_note');
    expect(CADDIE_SYSTEM_PROMPT).toContain('valley');
  });

  it('includes aim point specificity guidance', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('aim_point');
    expect(CADDIE_SYSTEM_PROMPT).toContain('visual landmark');
  });

  it('does not require strategy field in output schema', () => {
    // strategy was removed from required output — only legacy fallback
    const schemaSection = CADDIE_SYSTEM_PROMPT.slice(
      CADDIE_SYSTEM_PROMPT.indexOf('Return ONLY valid JSON')
    );
    expect(schemaSection).not.toContain('"strategy"');
  });
});

describe('buildPlaybookPrompt — course and tee data', () => {
  it('includes course name', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('Torrey Pines South');
  });

  it('includes tee yardage and rating', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(prompt).toContain('6874 yds');
    expect(prompt).toContain('74.6');
    expect(prompt).toContain('138');
  });

  it('includes hole yardages for the selected tee', () => {
    const prompt = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    // Hole 1 yardage for White tee is 350
    expect(prompt).toContain('350');
  });

  it('sorts holes by holeNumber ascending', () => {
    // Even if holes are shuffled, they should be sorted in the prompt
    const shuffledHoles = [...baseCourse.holes].sort(() => Math.random() - 0.5);
    const course = { ...baseCourse, holes: shuffledHoles };
    const prompt = buildPlaybookPrompt(baseProfile, course, 'White', baseWeather, 'Break 90');

    // In the JSON output of holes, "number":1 should appear before "number":18
    const pos1 = prompt.indexOf('"number": 1');
    const pos18 = prompt.indexOf('"number": 18');
    expect(pos1).toBeLessThan(pos18);
  });
});

describe('CADDIE_SYSTEM_PROMPT — lean schema fields', () => {
  it('includes play_bullets field in schema', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('"play_bullets"');
  });

  it('includes terrain_note field in schema', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('"terrain_note"');
  });

  it('includes carry_target field in schema', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('"carry_target"');
  });

  it('includes aim_point field in schema', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('"aim_point"');
  });

  it('includes bogey-first rule', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('Bogey');
  });

  it('includes word limit guidance', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('words');
  });

  it('buildPlaybookPrompt returns a non-empty string with minimal valid args', () => {
    const result = buildPlaybookPrompt(baseProfile, baseCourse, 'White', baseWeather, 'Break 90');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

// ── buildCustomCoursePrompt ────────────────────────────────────────────────

describe('buildCustomCoursePrompt', () => {
  const description = 'Hole 1: Par 4, 385 yards. Dogleg right at 210. OB left entire hole. Hole 2: Par 3, 165 yards. Green guarded by water front-left.';

  it('includes the course description verbatim', () => {
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description);
    expect(result).toContain(description);
  });

  it('includes player profile data', () => {
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description);
    expect(result).toContain('Sam');
    expect(result).toContain('18');
    expect(result).toContain('High hook left');
    expect(result).toContain('Break 90');
  });

  it('includes clubs with carry distances', () => {
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description);
    expect(result).toContain('Driver: 240 yds carry');
    expect(result).toContain('3-Hybrid: 210 yds carry');
    expect(result).toContain('FAIRWAY FINDER');
  });

  it('includes course name and tee name', () => {
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description);
    expect(result).toContain('Riviera CC');
    expect(result).toContain('Blue');
  });

  it('includes weather data', () => {
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description);
    expect(result).toContain('72°F');
    expect(result).toContain('10 mph');
  });

  it('injects caddie notes when provided', () => {
    const notes = Array(18).fill('') as string[];
    notes[0] = 'Valley at 185 plays 20y longer';
    notes[4] = 'Green always firm, back pin is dead';
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description, notes);
    expect(result).toContain('Valley at 185 plays 20y longer');
    expect(result).toContain('Green always firm');
    expect(result).toContain('CADDIE NOTES');
  });

  it('omits caddie notes section when notes are all empty', () => {
    const notes = Array(18).fill('') as string[];
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description, notes);
    expect(result).not.toContain('CADDIE NOTES');
  });

  it('omits caddie notes section when no notes passed', () => {
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description);
    expect(result).not.toContain('CADDIE NOTES');
  });

  it('includes instruction to work with incomplete hole data', () => {
    const result = buildCustomCoursePrompt(baseProfile, 'Riviera CC', 'Blue', baseWeather, 'Break 90', description);
    expect(result).toContain('Work with what you have');
  });
});

// ── Lean output schema ───────────────────────────────────────────────────────

describe('CADDIE_SYSTEM_PROMPT — lean output (no redundant fields)', () => {
  const schemaSection = CADDIE_SYSTEM_PROMPT.slice(
    CADDIE_SYSTEM_PROMPT.indexOf('Return ONLY valid JSON')
  );

  it('does not include hole_number in output schema', () => {
    expect(schemaSection).not.toContain('"hole_number"');
  });

  it('does not include yardage in output schema', () => {
    expect(schemaSection).not.toContain('"yardage"');
  });

  it('does not include par in output schema', () => {
    expect(schemaSection).not.toContain('"par"');
  });

  it('does not include miss_short in output schema', () => {
    expect(schemaSection).not.toContain('"miss_short"');
  });

  it('instructs Claude not to include hole_number, yardage, or par', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('Do NOT include hole_number, yardage, or par');
  });
});

// ── mergeDbDataIntoHoles ─────────────────────────────────────────────────────

describe('mergeDbDataIntoHoles', () => {
  const dbHoles = [
    { holeNumber: 1, par: 4, yardages: { White: 350, Blue: 380 }, handicapIndex: 5 },
    { holeNumber: 2, par: 3, yardages: { White: 165, Blue: 185 }, handicapIndex: 11 },
    { holeNumber: 3, par: 5, yardages: { White: 510, Blue: 545 }, handicapIndex: 1 },
  ];

  it('merges hole_number, yardage, par from DB into lean Claude output', () => {
    const leanHoles = [
      { tee_club: 'Driver', aim_point: 'center fairway', is_par_chance: true },
      { tee_club: '7-Iron', aim_point: 'middle of green', is_par_chance: false },
      { tee_club: '3-Wood', aim_point: 'left center', is_par_chance: true },
    ];

    const result = mergeDbDataIntoHoles(leanHoles, dbHoles, 'White');

    expect(result[0]).toMatchObject({ hole_number: 1, yardage: 350, par: 4, tee_club: 'Driver' });
    expect(result[1]).toMatchObject({ hole_number: 2, yardage: 165, par: 3, tee_club: '7-Iron' });
    expect(result[2]).toMatchObject({ hole_number: 3, yardage: 510, par: 5, tee_club: '3-Wood' });
  });

  it('uses correct tee yardage', () => {
    const leanHoles = [{ tee_club: 'Driver' }];
    const result = mergeDbDataIntoHoles(leanHoles, [dbHoles[0]], 'Blue');
    expect(result[0]).toMatchObject({ yardage: 380 });
  });

  it('handles unsorted DB holes by sorting them', () => {
    const unsorted = [dbHoles[2], dbHoles[0], dbHoles[1]];
    const leanHoles = [
      { tee_club: 'Driver' },
      { tee_club: '7-Iron' },
      { tee_club: '3-Wood' },
    ];

    const result = mergeDbDataIntoHoles(leanHoles, unsorted, 'White');
    expect(result[0]).toMatchObject({ hole_number: 1, tee_club: 'Driver' });
    expect(result[1]).toMatchObject({ hole_number: 2, tee_club: '7-Iron' });
    expect(result[2]).toMatchObject({ hole_number: 3, tee_club: '3-Wood' });
  });

  it('preserves all Claude strategy fields', () => {
    const leanHoles = [{
      tee_club: 'Driver',
      aim_point: 'left bunker edge',
      carry_target: 220,
      play_bullets: ['Hit driver to left side', 'Wedge approach'],
      terrain_note: '10ft uphill to green',
      miss_left: 'Chip back to fairway',
      miss_right: 'Punch under trees',
      danger: 'OB right off the tee',
      target: 'Bogey',
      is_par_chance: false,
    }];

    const result = mergeDbDataIntoHoles(leanHoles, [dbHoles[0]], 'White');
    expect(result[0]).toMatchObject({
      hole_number: 1,
      yardage: 350,
      par: 4,
      tee_club: 'Driver',
      aim_point: 'left bunker edge',
      carry_target: 220,
      danger: 'OB right off the tee',
    });
  });

  it('handles empty lean holes array', () => {
    const result = mergeDbDataIntoHoles([], dbHoles, 'White');
    expect(result).toEqual([]);
  });
});
