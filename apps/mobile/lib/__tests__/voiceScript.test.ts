import { describe, it, expect } from 'vitest';
import { buildVoiceScript } from '../voiceScript';
import type { HoleStrategy } from '../api';

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
  ],
  terrain_note: '',
  miss_left: 'Rough left, chip out.',
  miss_right: 'Bunker right, splash out.',
  miss_short: 'Advance past the creek.',
  danger: 'OB left beyond the trees.',
  target: 'Bogey',
  is_par_chance: false,
};

describe('buildVoiceScript', () => {
  it('includes club and aim point', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('3-Hybrid');
    expect(script).toContain('aim left edge of right fairway bunker');
  });

  it('includes only the first play bullet', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('Hit 3-Hybrid to left edge of bunker.');
    expect(script).not.toContain('Approach with 8-iron');
  });

  it('includes danger', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain('ob left beyond the trees');
  });

  it('ends with closing', () => {
    const script = buildVoiceScript(baseHole);
    expect(script).toContain("let's go");
  });

  it('par chance holes get aggressive closing', () => {
    const hole = { ...baseHole, is_par_chance: true };
    const script = buildVoiceScript(hole);
    expect(script).toContain('get this one');
  });

  it('stays under 40 words', () => {
    const script = buildVoiceScript(baseHole);
    const wordCount = script.split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(40);
  });

  it('omits aim point when missing', () => {
    const hole = { ...baseHole, aim_point: undefined };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('aim');
    expect(script).toContain('3-Hybrid here');
  });

  it('falls back to strategy when play_bullets is missing', () => {
    const hole: HoleStrategy = {
      ...baseHole,
      play_bullets: undefined,
      strategy: 'Lay up short of the bunkers.',
    };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('Lay up');
  });

  it('handles missing danger gracefully', () => {
    const hole = { ...baseHole, danger: '' };
    const script = buildVoiceScript(hole);
    expect(script).not.toContain('Avoid');
  });
});
