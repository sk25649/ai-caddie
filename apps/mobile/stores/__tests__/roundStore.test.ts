import { describe, it, expect, beforeEach } from 'vitest';
// use the actual store
import { useRoundStore } from '../roundStore';

describe('roundStore - competition mode', () => {
  beforeEach(() => {
    useRoundStore.getState().reset();
  });

  it('defaults to false', () => {
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
});
