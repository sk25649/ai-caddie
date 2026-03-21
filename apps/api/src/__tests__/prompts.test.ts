import { describe, it, expect } from 'vitest';
import { buildPlaybookPrompt, CADDIE_SYSTEM_PROMPT } from '../lib/prompts';

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

  it('handles null carryDistance as 0 for sorting', () => {
    const profile = {
      ...baseProfile,
      clubs: [
        { clubName: 'Putter', carryDistance: null, isFairwayFinder: false },
        { clubName: 'Driver', carryDistance: 240, isFairwayFinder: false },
      ],
    };
    // Should not throw
    expect(() =>
      buildPlaybookPrompt(profile, baseCourse, 'White', baseWeather, 'Break 90')
    ).not.toThrow();
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

  it('includes terrain CRITICAL RULE about elevation and valleys', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('TERRAIN');
    expect(CADDIE_SYSTEM_PROMPT).toContain('elevationChange');
    expect(CADDIE_SYSTEM_PROMPT).toContain('valleys');
  });

  it('includes aim point specificity CRITICAL RULE', () => {
    expect(CADDIE_SYSTEM_PROMPT).toContain('AIM POINT');
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
