import { describe, it, expect } from 'vitest';
import { buildVoiceScript } from '../voiceScript';
import type { HoleStrategy } from '../api';

// ── Fixtures ───────────────────────────────────────────────────────────────

const baseHole: HoleStrategy = {
  hole_number: 5,
  yardage: 380,
  par: 4,
  tee_club: '3-Hybrid',
  aim_point: 'left edge of right fairway bunker',
  carry_target: 210,
  play_bullets: [
    'Hit 3-Hybrid to left edge of bunker.',
    'Approach with 8-iron from 155.',
    'Bogey is perfectly fine here.',
  ],
  terrain_note: '',
  miss_left: 'Rough left, chip out.',
  miss_right: 'Bunker right, splash out.',
  miss_short: 'Advance past the creek.',
  danger: 'OB left beyond the trees.',
  target: 'Bogey',
  is_par_chance: false,
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('buildVoiceScript — intro', () => {
  it('always includes hole number, par, and yardage', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('Hole 5');
    expect(script).toContain('Par 4');
    expect(script).toContain('380 yards');
  });

  it('always includes the club', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('Club: 3-Hybrid');
  });

  it('always ends with the danger callout', () => {
    const script = buildVoiceScript(baseHole);
    expect(script.endsWith('Danger: OB left beyond the trees.')).toBe(true);
  });
});

describe('buildVoiceScript — aim point and carry target', () => {
  it('includes aim point when present', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('Aim at left edge of right fairway bunker.');
  });

  it('includes carry target when present', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('Carry 210 yards to the landing zone.');
  });

  it('omits aim point section when aim_point is missing', () => {
    const hole = { ...baseHole, aim_point: undefined };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('Aim at');
  });

  it('omits carry target section when carry_target is missing', () => {
    const hole = { ...baseHole, carry_target: undefined };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('yards to the landing zone');
  });
});

describe('buildVoiceScript — play bullets', () => {
  it('reads all three bullets in order', () => {
    const script = buildVoiceScript(baseHole);
    const bullet1Pos = script.indexOf('Hit 3-Hybrid to left edge of bunker.');
    const bullet2Pos = script.indexOf('Approach with 8-iron from 155.');
    const bullet3Pos = script.indexOf('Bogey is perfectly fine here.');
    expect(bullet1Pos).toBeGreaterThan(-1);
    expect(bullet2Pos).toBeGreaterThan(bullet1Pos);
    expect(bullet3Pos).toBeGreaterThan(bullet2Pos);
  });

  it('falls back to strategy text when play_bullets is missing', () => {
    const hole: HoleStrategy = {
      ...baseHole,
      play_bullets: undefined,
      strategy: 'Aim center and lay up short of the bunkers.',
    };
    const script = buildVoiceScript(hole);
    expect(script).toContain('Aim center and lay up short of the bunkers.');
    expect(script).not.toContain('Hit 3-Hybrid');
  });

  it('falls back to strategy when play_bullets is empty array', () => {
    const hole: HoleStrategy = {
      ...baseHole,
      play_bullets: [],
      strategy: 'Legacy strategy text.',
    };
    const script = buildVoiceScript(hole);
    expect(script).toContain('Legacy strategy text.');
  });

  it('includes no bullet/strategy content when both are missing', () => {
    const hole: HoleStrategy = { ...baseHole, play_bullets: undefined, strategy: undefined };
    const script = buildVoiceScript(hole);
    // Should not throw and should still have the other parts
    expect(script).toContain('Hole 5');
    expect(script).toContain('Danger:');
  });
});

describe('buildVoiceScript — terrain note', () => {
  it('includes terrain warning when terrain_note is non-empty', () => {
    const hole: HoleStrategy = {
      ...baseHole,
      terrain_note: 'Hidden valley at 160 yards carry — ball will drop a full club length.',
    };
    const script = buildVoiceScript(hole);
    expect(script).toContain('Terrain warning: Hidden valley at 160 yards carry');
  });

  it('omits terrain warning when terrain_note is empty string', () => {
    const script = buildVoiceScript(baseHole); // terrain_note: ''
    expect(script).not.toContain('Terrain warning');
  });

  it('omits terrain warning when terrain_note is whitespace only', () => {
    const hole: HoleStrategy = { ...baseHole, terrain_note: '   ' };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('Terrain warning');
  });

  it('omits terrain warning when terrain_note is undefined', () => {
    const hole: HoleStrategy = { ...baseHole, terrain_note: undefined };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('Terrain warning');
  });
});

describe('buildVoiceScript — ordering', () => {
  it('reads terrain warning before danger', () => {
    const hole: HoleStrategy = {
      ...baseHole,
      terrain_note: 'Sharp drop at landing zone.',
    };
    const script = buildVoiceScript(hole);
    const terrainPos = script.indexOf('Terrain warning:');
    const dangerPos = script.indexOf('Danger:');
    expect(terrainPos).toBeLessThan(dangerPos);
  });

  it('reads aim point before carry target', () => {
    const script = buildVoiceScript(baseHole);
    const aimPos = script.indexOf('Aim at');
    const carryPos = script.indexOf('Carry');
    expect(aimPos).toBeLessThan(carryPos);
  });

  it('reads club before aim point', () => {
    const script = buildVoiceScript(baseHole);
    const clubPos = script.indexOf('Club:');
    const aimPos = script.indexOf('Aim at');
    expect(clubPos).toBeLessThan(aimPos);
  });
});

describe('buildVoiceScript — par 3 holes', () => {
  it('handles par 3 with different hole/yardage', () => {
    const par3: HoleStrategy = {
      ...baseHole,
      hole_number: 12,
      par: 3,
      yardage: 175,
      tee_club: '6-Iron',
      aim_point: 'front-left pin, back tier is dead',
      carry_target: 170,
    };
    const script = buildVoiceScript(par3);
    expect(script).toContain('Hole 12. Par 3. 175 yards.');
    expect(script).toContain('Club: 6-Iron.');
    expect(script).toContain('Aim at front-left pin');
    expect(script).toContain('Carry 170 yards');
  });
});
