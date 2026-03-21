import { describe, it, expect } from 'vitest';
import {
  generateYardageBookHtml,
  firstSentence,
  escapeHtml,
  degreesToCompass,
  extractWeather,
} from '../lib/yardage-book';
import type { HoleStrategy } from '../db/schema';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeHole(n: number, overrides: Partial<HoleStrategy> = {}): HoleStrategy {
  return {
    hole_number: n,
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
    miss_left: 'Rough left, pitch out. Stay calm.',
    miss_right: 'Rough right, pitch out. No hero shots.',
    miss_short: 'Advance to wedge distance. Easy chip.',
    danger: 'OB left.',
    target: 'Bogey',
    is_par_chance: n <= 3,
    do_this: ['Take 3-Hybrid', 'Aim left center', 'Commit to bogey'],
    dont_do: ['No driver — slice goes OB', 'Avoid right rough'],
    approach_club: '7-Iron',
    approach_distance: 160,
    ...overrides,
  };
}

const baseProfile = {
  displayName: 'Sam Golfer',
  handicap: '18',
  dreamScore: 85,
  goalScore: 89,
  floorScore: 99,
  missPrimary: 'High hook left',
};

const baseClubs = [
  { clubName: 'Driver', carryDistance: 240, isFairwayFinder: false, sortOrder: 0 },
  { clubName: '3-Hybrid', carryDistance: 210, isFairwayFinder: true, sortOrder: 1 },
  { clubName: '7-Iron', carryDistance: 160, isFairwayFinder: false, sortOrder: 2 },
  { clubName: 'PW', carryDistance: 125, isFairwayFinder: false, sortOrder: 3 },
];

const baseCourse = { name: 'Torrey Pines South', par: 72 };

const basePlaybook = {
  id: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  teeName: 'White',
  roundDate: '2026-03-20',
  teeTime: '10:00',
  preRoundTalk: 'Stay patient, bogey is your par. Commit to every shot. No hero swings.',
  holeStrategies: Array.from({ length: 18 }, (_, i) => makeHole(i + 1)),
  projectedScore: 89,
  driverHoles: [9, 18],
  parChanceHoles: [1, 2, 3],
  weatherConditions: {
    temp: 72,
    wind_speed: 8,
    wind_deg: 180,
    weather: [{ description: 'sunny' }],
  },
};

// ── generateYardageBookHtml ───────────────────────────────────────────────────

describe('generateYardageBookHtml — structure', () => {
  it('returns a string starting with <!DOCTYPE html', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(typeof html).toBe('string');
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html/i);
  });

  it('contains <html and </html>', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('has 20 page sections (cover + 18 holes + scorecard)', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    // Each page section has class="page" — count occurrences of 'class="page'
    const matches = html.match(/class="page/g);
    expect(matches).not.toBeNull();
    // Cover (page-break), 18 holes (page-break), scorecard (no page-break) = 20 divs with class starting "page"
    expect(matches!.length).toBe(20);
  });
});

describe('generateYardageBookHtml — cover page', () => {
  it('contains player name', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Sam Golfer');
  });

  it('contains course name', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Torrey Pines South');
  });

  it('contains handicap', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('HCP 18');
  });

  it('contains tee name and round date', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('White');
    expect(html).toContain('2026-03-20');
  });

  it('contains pre-round talk as bullet points', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Stay patient');
    expect(html).toContain('<li>');
  });

  it('contains dream, goal, floor scores', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('85');
    expect(html).toContain('89');
    expect(html).toContain('99');
  });

  it('contains bag clubs', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Driver');
    expect(html).toContain('3-Hybrid');
  });

  it('marks fairway finder clubs with a star', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    // 3-Hybrid is the fairway finder
    expect(html).toContain('3-Hybrid');
    // The star should appear near 3-Hybrid in the cover bag section
    const hybridIdx = html.indexOf('3-Hybrid 210y ★');
    expect(hybridIdx).toBeGreaterThan(-1);
  });

  it('contains weather when present', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('72°F');
    expect(html).toContain('8mph');
    expect(html).toContain('sunny');
  });

  it('omits weather section when weatherConditions is null', () => {
    const playbook = { ...basePlaybook, weatherConditions: null };
    const html = generateYardageBookHtml(playbook, baseProfile, baseClubs, baseCourse);
    expect(html).not.toContain('Weather Today');
  });

  it('uses Golfer as fallback when displayName is null', () => {
    const profile = { ...baseProfile, displayName: null };
    const html = generateYardageBookHtml(basePlaybook, profile, baseClubs, baseCourse);
    expect(html).toContain('Golfer');
  });
});

describe('generateYardageBookHtml — hole pages', () => {
  it('contains hole numbers 1 through 18', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    for (let i = 1; i <= 18; i++) {
      expect(html).toContain(`HOLE ${i}`);
    }
  });

  it('shows star for par chance holes', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    // Holes 1-3 are par chances in fixtures
    expect(html).toContain('PAR CHANCE');
    expect(html).toContain('&#9733;');
  });

  it('shows BOGEY TARGET for non-par-chance holes', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('BOGEY TARGET');
  });

  it('renders terrain note when non-empty', () => {
    const holesWithTerrain = basePlaybook.holeStrategies.map((h, i) =>
      i === 5 ? { ...h, terrain_note: 'Hidden valley drops 30 yards past landing zone' } : h
    );
    const playbook = { ...basePlaybook, holeStrategies: holesWithTerrain };
    const html = generateYardageBookHtml(playbook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('class="terrain-box"');
    expect(html).toContain('Hidden valley drops 30 yards past landing zone');
  });

  it('does NOT render terrain box when terrain_note is empty string', () => {
    // All holes in basePlaybook have terrain_note: ''
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    // The class is defined in CSS but the div should never be rendered
    expect(html).not.toContain('class="terrain-box"');
  });

  it('does NOT render terrain box when terrain_note is null/undefined', () => {
    const holesNoTerrain = basePlaybook.holeStrategies.map((h) => {
      const { terrain_note, ...rest } = h;
      return rest as HoleStrategy;
    });
    const playbook = { ...basePlaybook, holeStrategies: holesNoTerrain };
    const html = generateYardageBookHtml(playbook, baseProfile, baseClubs, baseCourse);
    expect(html).not.toContain('class="terrain-box"');
  });

  it('uses do_this items when present', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Take 3-Hybrid');
    expect(html).toContain('Do This');
  });

  it('falls back to play_bullets when do_this is missing', () => {
    const holesNoDo = basePlaybook.holeStrategies.map((h) => {
      const { do_this, dont_do, ...rest } = h;
      return rest as HoleStrategy;
    });
    const playbook = { ...basePlaybook, holeStrategies: holesNoDo };
    const html = generateYardageBookHtml(playbook, baseProfile, baseClubs, baseCourse);
    // play_bullets[0] from fixtures
    expect(html).toContain('Hit 3-Hybrid to left edge of bunker.');
  });

  it('falls back to danger for dont_do when both do_this and dont_do are missing', () => {
    const holesMinimal = basePlaybook.holeStrategies.map((h) => {
      const { do_this, dont_do, play_bullets, ...rest } = h;
      return rest as HoleStrategy;
    });
    const playbook = { ...basePlaybook, holeStrategies: holesMinimal };
    const html = generateYardageBookHtml(playbook, baseProfile, baseClubs, baseCourse);
    // danger is 'OB left.' — should appear in Not This column
    expect(html).toContain('Not This');
    expect(html).toContain('OB left.');
  });

  it('renders approach club and distance when present', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Approach');
    expect(html).toContain('7-Iron');
    expect(html).toContain('160');
  });

  it('omits approach section when approach_club is absent', () => {
    const holesNoApproach = basePlaybook.holeStrategies.map((h) => {
      const { approach_club, approach_distance, ...rest } = h;
      return rest as HoleStrategy;
    });
    const playbook = { ...basePlaybook, holeStrategies: holesNoApproach };
    const html = generateYardageBookHtml(playbook, baseProfile, baseClubs, baseCourse);
    expect(html).not.toContain('Approach');
  });

  it('renders miss left/right/short with first sentence only', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    // First sentence of miss_left is "Rough left, pitch out."
    expect(html).toContain('Rough left, pitch out.');
    // Second sentence "Stay calm." should NOT appear (first sentence only)
    expect(html).not.toContain('Stay calm.');
  });

  it('shows score row footer with par values', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    // Par 4 hole: Birdie(3), Par(4), Bogey(5), Double(6)
    expect(html).toContain('Birdie (3)');
    expect(html).toContain('Bogey (5)');
    expect(html).toContain('Score: ____');
  });
});

describe('generateYardageBookHtml — scorecard page', () => {
  it('contains Scorecard heading', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Scorecard');
  });

  it('contains OUT and IN totals rows', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('>OUT<');
    expect(html).toContain('>IN<');
    expect(html).toContain('>TOTAL<');
  });

  it('shows B★ for par chance holes in scorecard', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    // Par chance holes get B★ (rendered as B&#9733;)
    expect(html).toContain('B&#9733;');
  });

  it('shows driver holes list', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Driver holes: 9, 18');
  });

  it('shows par chance count', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Par chances: 3');
  });

  it('shows goal/dream/floor scores in scorecard', () => {
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Dream:');
    expect(html).toContain('Goal:');
    expect(html).toContain('Floor:');
  });

  it('shows — for driver holes when driverHoles is null', () => {
    const playbook = { ...basePlaybook, driverHoles: null };
    const html = generateYardageBookHtml(playbook, baseProfile, baseClubs, baseCourse);
    expect(html).toContain('Driver holes: —');
  });
});

describe('generateYardageBookHtml — HTML safety', () => {
  it('escapes HTML special chars in player name', () => {
    const profile = { ...baseProfile, displayName: '<script>alert(1)</script>' };
    const html = generateYardageBookHtml(basePlaybook, profile, baseClubs, baseCourse);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML special chars in course name', () => {
    const course = { name: 'Course & "Resort" <Test>', par: 72 };
    const html = generateYardageBookHtml(basePlaybook, baseProfile, baseClubs, course);
    expect(html).not.toContain('Course & "Resort"');
    expect(html).toContain('Course &amp;');
  });
});

// ── firstSentence helper ──────────────────────────────────────────────────────

describe('firstSentence', () => {
  it('returns text up to first ". " (period + space)', () => {
    expect(firstSentence('Rough left, pitch out. Stay calm.')).toBe('Rough left, pitch out.');
  });

  it('returns full string when no ". " found', () => {
    expect(firstSentence('No period here')).toBe('No period here');
  });

  it('handles string ending with period but no space after', () => {
    expect(firstSentence('Single sentence.')).toBe('Single sentence.');
  });

  it('handles empty string', () => {
    expect(firstSentence('')).toBe('');
  });

  it('handles multiple sentences — returns only first', () => {
    expect(firstSentence('First. Second. Third.')).toBe('First.');
  });
});

// ── degreesToCompass helper ───────────────────────────────────────────────────

describe('degreesToCompass', () => {
  it('converts 0 to N', () => expect(degreesToCompass(0)).toBe('N'));
  it('converts 90 to E', () => expect(degreesToCompass(90)).toBe('E'));
  it('converts 180 to S', () => expect(degreesToCompass(180)).toBe('S'));
  it('converts 270 to W', () => expect(degreesToCompass(270)).toBe('W'));
  it('converts 45 to NE', () => expect(degreesToCompass(45)).toBe('NE'));
  it('converts 315 to NW', () => expect(degreesToCompass(315)).toBe('NW'));
  it('converts 360 back to N', () => expect(degreesToCompass(360)).toBe('N'));
});

// ── extractWeather helper ─────────────────────────────────────────────────────

describe('extractWeather', () => {
  it('extracts temp, windSpeed, compass, conditions from full data', () => {
    const result = extractWeather({
      temp: 72.4,
      wind_speed: 8.1,
      wind_deg: 180,
      weather: [{ description: 'partly cloudy' }],
    });
    expect(result.temp).toBe('72');
    expect(result.windSpeed).toBe('8');
    expect(result.compass).toBe('S');
    expect(result.conditions).toBe('partly cloudy');
  });

  it('falls back gracefully when weatherConditions is null', () => {
    const result = extractWeather(null);
    expect(result.temp).toBe('—');
    expect(result.windSpeed).toBe('—');
    expect(result.compass).toBe('—');
    expect(result.conditions).toBe('clear');
  });

  it('falls back to — for missing temp', () => {
    const result = extractWeather({ wind_speed: 10, wind_deg: 90, weather: [] });
    expect(result.temp).toBe('—');
  });

  it('falls back to clear when weather array is empty', () => {
    const result = extractWeather({ temp: 70, wind_speed: 5, wind_deg: 0, weather: [] });
    expect(result.conditions).toBe('clear');
  });

  it('falls back to clear when weather key is missing', () => {
    const result = extractWeather({ temp: 70, wind_speed: 5, wind_deg: 0 });
    expect(result.conditions).toBe('clear');
  });
});

// ── escapeHtml helper ─────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  it('escapes &', () => expect(escapeHtml('a & b')).toBe('a &amp; b'));
  it('escapes <', () => expect(escapeHtml('<div>')).toBe('&lt;div&gt;'));
  it('escapes "', () => expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;'));
  it('leaves safe strings unchanged', () => expect(escapeHtml('hello world')).toBe('hello world'));
});
