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
  it('includes hole number, par, and yardage', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('hole 5');
    expect(script).toContain('par 4');
    expect(script).toContain('380 yard');
  });

  it('includes the club recommendation', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('3-Hybrid');
  });

  it('ends with a closing motivational line', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain("let's go");
  });
});

describe('buildVoiceScript — aim point and carry target', () => {
  it('includes aim point when present', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('Aim at left edge of right fairway bunker');
  });

  it('includes carry target when present', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('210');
    expect(script).toContain('clear');
  });

  it('omits aim point when missing', () => {
    const hole = { ...baseHole, aim_point: undefined };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('Aim at');
  });

  it('omits carry target when missing', () => {
    const hole = { ...baseHole, carry_target: undefined };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('to clear');
  });
});

describe('buildVoiceScript — play bullets', () => {
  it('reads all three bullets in order', () => {
    const script = buildVoiceScript(baseHole);
    const b1 = script.indexOf('Hit 3-Hybrid to left edge of bunker.');
    const b2 = script.indexOf('Approach with 8-iron from 155.');
    const b3 = script.indexOf('Bogey is perfectly fine here.');
    expect(b1).toBeGreaterThan(-1);
    expect(b2).toBeGreaterThan(b1);
    expect(b3).toBeGreaterThan(b2);
  });

  it('falls back to strategy text when play_bullets is missing', () => {
    const hole: HoleStrategy = {
      ...baseHole,
      play_bullets: undefined,
      strategy: 'Aim center and lay up short of the bunkers.',
    };
    const script = buildVoiceScript(hole);
    expect(script).toContain('Aim center and lay up short of the bunkers.');
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

  it('still works when both are missing', () => {
    const hole: HoleStrategy = { ...baseHole, play_bullets: undefined, strategy: undefined };
    const script = buildVoiceScript(hole);
    expect(script).toContain('hole 5');
  });
});

describe('buildVoiceScript — terrain note', () => {
  it('includes terrain heads-up when terrain_note is non-empty', () => {
    const hole: HoleStrategy = {
      ...baseHole,
      terrain_note: 'Hidden valley at 160 yards',
    };
    const script = buildVoiceScript(hole);
    expect(script).toContain('Watch out');
    expect(script).toContain('Hidden valley at 160 yards');
  });

  it('omits terrain when terrain_note is empty string', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).not.toContain('Watch out');
  });

  it('omits terrain when terrain_note is whitespace only', () => {
    const hole: HoleStrategy = { ...baseHole, terrain_note: '   ' };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('Watch out');
  });

  it('omits terrain when terrain_note is undefined', () => {
    const hole: HoleStrategy = { ...baseHole, terrain_note: undefined };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('Watch out');
  });
});

describe('buildVoiceScript — danger and closing', () => {
  it('includes danger callout', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('Big miss is OB left beyond the trees');
  });

  it('reads terrain before danger', () => {
    const hole: HoleStrategy = {
      ...baseHole,
      terrain_note: 'Sharp drop at landing zone.',
    };
    const script = buildVoiceScript(hole);
    const terrainPos = script.indexOf('Watch out');
    const dangerPos = script.indexOf('Big miss');
    expect(terrainPos).toBeLessThan(dangerPos);
  });

  it('par chance holes get aggressive closing', () => {
    const hole = { ...baseHole, is_par_chance: true };
    const script = buildVoiceScript(hole);
    expect(script).toContain('birdie or par');
  });

  it('non par chance holes get bogey-smart closing', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('Bogey is a great score');
  });
});

describe('buildVoiceScript — par 3 holes', () => {
  it('handles par 3 with correct wording', () => {
    const par3: HoleStrategy = {
      ...baseHole,
      hole_number: 12,
      par: 3,
      yardage: 175,
      tee_club: '6-Iron',
      aim_point: 'front-left pin',
      carry_target: 170,
      is_par_chance: true,
    };
    const script = buildVoiceScript(par3);
    expect(script).toContain('hole 12');
    expect(script).toContain('par 3');
    expect(script).toContain('175 yard');
    expect(script).toContain('6-Iron');
    expect(script).toContain('Aim at front-left pin');
    expect(script).toContain('170');
  });
});
