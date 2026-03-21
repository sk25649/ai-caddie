import { describe, it, expect } from 'vitest';
import { StreamingHoleParser } from '../lib/stream-parser';

// Helper: simulate streaming by feeding one character at a time
function feedCharByChar(parser: StreamingHoleParser, text: string) {
  const allHoles: Array<Record<string, unknown>> = [];
  let meta = undefined;
  for (const ch of text) {
    const result = parser.onDelta(ch);
    if (result.meta) meta = result.meta;
    allHoles.push(...result.holes);
  }
  return { meta, holes: allHoles };
}

// Helper: simulate streaming in chunks
function feedInChunks(parser: StreamingHoleParser, text: string, chunkSize: number) {
  const allHoles: Array<Record<string, unknown>> = [];
  let meta = undefined;
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    const result = parser.onDelta(chunk);
    if (result.meta) meta = result.meta;
    allHoles.push(...result.holes);
  }
  return { meta, holes: allHoles };
}

const sampleResponse = JSON.stringify({
  pre_round_talk: 'Stay patient, bogey is your par.',
  projected_score: 89,
  driver_holes: [1, 9, 18],
  par_chance_holes: [3, 8, 14],
  holes: [
    { tee_club: 'Driver', aim_point: 'center fairway', is_par_chance: true },
    { tee_club: '7-Iron', aim_point: 'middle of green', is_par_chance: false },
    { tee_club: '3-Wood', aim_point: 'left side', is_par_chance: true },
  ],
});

describe('StreamingHoleParser — meta extraction', () => {
  it('extracts meta fields when fed all at once', () => {
    const parser = new StreamingHoleParser();
    const result = parser.onDelta(sampleResponse);
    expect(result.meta).toBeDefined();
    expect(result.meta!.pre_round_talk).toBe('Stay patient, bogey is your par.');
    expect(result.meta!.projected_score).toBe(89);
    expect(result.meta!.driver_holes).toEqual([1, 9, 18]);
    expect(result.meta!.par_chance_holes).toEqual([3, 8, 14]);
  });

  it('extracts meta when streamed char by char', () => {
    const parser = new StreamingHoleParser();
    const { meta } = feedCharByChar(parser, sampleResponse);
    expect(meta).toBeDefined();
    expect(meta!.projected_score).toBe(89);
  });

  it('emits meta only once', () => {
    const parser = new StreamingHoleParser();
    const r1 = parser.onDelta(sampleResponse.slice(0, 200));
    const r2 = parser.onDelta(sampleResponse.slice(200));
    // At most one of these should have meta
    const metaCount = [r1.meta, r2.meta].filter(Boolean).length;
    expect(metaCount).toBeLessThanOrEqual(1);
  });
});

describe('StreamingHoleParser — hole extraction', () => {
  it('extracts all 3 holes when fed all at once', () => {
    const parser = new StreamingHoleParser();
    const result = parser.onDelta(sampleResponse);
    expect(result.holes.length).toBe(3);
    expect(result.holes[0]).toMatchObject({ tee_club: 'Driver' });
    expect(result.holes[1]).toMatchObject({ tee_club: '7-Iron' });
    expect(result.holes[2]).toMatchObject({ tee_club: '3-Wood' });
  });

  it('extracts holes progressively when streamed in chunks', () => {
    const parser = new StreamingHoleParser();
    const { holes } = feedInChunks(parser, sampleResponse, 50);
    expect(holes.length).toBe(3);
  });

  it('extracts holes char by char', () => {
    const parser = new StreamingHoleParser();
    const { holes } = feedCharByChar(parser, sampleResponse);
    expect(holes.length).toBe(3);
    expect(holes[0]).toMatchObject({ tee_club: 'Driver' });
  });

  it('tracks emitted holes via getEmittedHoles()', () => {
    const parser = new StreamingHoleParser();
    feedCharByChar(parser, sampleResponse);
    expect(parser.getEmittedHoles().length).toBe(3);
  });
});

describe('StreamingHoleParser — edge cases', () => {
  it('handles strings with braces inside', () => {
    const response = JSON.stringify({
      pre_round_talk: 'Be smart {not risky}.',
      projected_score: 92,
      driver_holes: [],
      par_chance_holes: [],
      holes: [
        { tee_club: 'Driver', danger: 'OB {left} fence line' },
      ],
    });
    const parser = new StreamingHoleParser();
    const { holes } = feedCharByChar(parser, response);
    expect(holes.length).toBe(1);
    expect(holes[0]).toMatchObject({ danger: 'OB {left} fence line' });
  });

  it('handles escaped quotes in strings', () => {
    const response = JSON.stringify({
      pre_round_talk: 'They call it "The Beast".',
      projected_score: 95,
      driver_holes: [],
      par_chance_holes: [],
      holes: [
        { tee_club: 'Driver', aim_point: 'center of "the valley"' },
      ],
    });
    const parser = new StreamingHoleParser();
    const { holes } = feedCharByChar(parser, response);
    expect(holes.length).toBe(1);
  });

  it('handles nested arrays in hole objects', () => {
    const response = JSON.stringify({
      pre_round_talk: 'Play smart.',
      projected_score: 90,
      driver_holes: [1],
      par_chance_holes: [1],
      holes: [
        {
          tee_club: 'Driver',
          play_bullets: ['Hit driver long', 'Pitch to 10 feet'],
          is_par_chance: true,
        },
      ],
    });
    const parser = new StreamingHoleParser();
    const { holes } = feedCharByChar(parser, response);
    expect(holes.length).toBe(1);
    expect(holes[0]).toMatchObject({
      play_bullets: ['Hit driver long', 'Pitch to 10 feet'],
    });
  });

  it('accumulates full text via getFullText()', () => {
    const parser = new StreamingHoleParser();
    parser.onDelta('hello ');
    parser.onDelta('world');
    expect(parser.getFullText()).toBe('hello world');
  });

  it('handles markdown code fence wrapper', () => {
    const fenced = '```json\n' + sampleResponse + '\n```';
    const parser = new StreamingHoleParser();
    const { holes } = feedCharByChar(parser, fenced);
    expect(holes.length).toBe(3);
  });
});
