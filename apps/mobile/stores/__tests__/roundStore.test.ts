import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('expo-secure-store', () => ({
  default: {},
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

import { useRoundStore } from '../roundStore';

describe('roundStore', () => {
  beforeEach(() => {
    useRoundStore.getState().reset();
  });

  it('defaults to false competition mode', () => {
    expect(useRoundStore.getState().isCompetitionMode).toBe(false);
  });

  it('setCompetitionMode sets to true', () => {
    useRoundStore.getState().setCompetitionMode(true);
    expect(useRoundStore.getState().isCompetitionMode).toBe(true);
  });

  it('setCompetitionMode sets back to false', () => {
    useRoundStore.getState().setCompetitionMode(true);
    useRoundStore.getState().setCompetitionMode(false);
    expect(useRoundStore.getState().isCompetitionMode).toBe(false);
  });

  it('reset clears competition mode', () => {
    useRoundStore.getState().setCompetitionMode(true);
    useRoundStore.getState().reset();
    expect(useRoundStore.getState().isCompetitionMode).toBe(false);
  });

  it('allows correcting an existing score without clearing first', () => {
    useRoundStore.getState().setScore(0, 5);
    useRoundStore.getState().setScore(0, 4);
    expect(useRoundStore.getState().scores[0]).toBe(4);
  });

  it('tracks direct hole selection until reset', () => {
    useRoundStore.getState().setHoleSelection(18, 0);
    useRoundStore.getState().setCurrentHole(6);
    expect(useRoundStore.getState().currentHole).toBe(6);
    useRoundStore.getState().reset();
    expect(useRoundStore.getState().currentHole).toBe(0);
  });
});
