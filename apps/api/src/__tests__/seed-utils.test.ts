import { describe, it, expect } from 'vitest';
import { slugify } from '../scripts/seed-utils';

describe('slugify', () => {
  it('lowercases the string', () => {
    expect(slugify('Pebble Beach')).toBe('pebble-beach');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('Pine Valley Golf Club')).toBe('pine-valley-golf-club');
  });

  it('handles consecutive special chars', () => {
    expect(slugify("Winged Foot G.C.")).toBe('winged-foot-g-c');
  });

  it('strips leading/trailing hyphens', () => {
    expect(slugify('  Augusta  ')).toBe('augusta');
  });

  it('handles numbers', () => {
    expect(slugify('TPC at Sawgrass 17')).toBe('tpc-at-sawgrass-17');
  });
});
