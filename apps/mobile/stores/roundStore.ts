import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Playbook, Course, HoleStrategy } from '../lib/api';

type StreamingStatus = 'idle' | 'streaming' | 'done' | 'error';

const ROUND_STATE_KEY = 'active_round_state';

interface PersistedRoundState {
  selectedCourse: Course | null;
  selectedTee: string | null;
  roundDate: string | null;
  teeTime: string | null;
  scoringGoal: string | null;
  playbook: Playbook | null;
  scores: (number | null)[];
  currentHole: number;
  isCompetitionMode: boolean;
  holeNotes: string[];
  streamingStatus: StreamingStatus;
  streamingHoles: (HoleStrategy | null)[];
  streamingMeta: { pre_round_talk: string; projected_score: number; driver_holes: number[]; par_chance_holes: number[] } | null;
  isCustomCourse: boolean;
  customCourseName: string | null;
  customCourseTeeName: string | null;
  customCourseDescription: string | null;
  customCourseCity: string | null;
  customCourseState: string | null;
  holesCount: 9 | 18;
  holesStart: 0 | 9;
}

interface RoundState {
  // Round setup
  selectedCourse: Course | null;
  selectedTee: string | null;
  roundDate: string | null;
  teeTime: string | null;
  scoringGoal: string | null;

  // Active round
  playbook: Playbook | null;
  scores: (number | null)[];
  currentHole: number;

  isCompetitionMode: boolean;

  holeNotes: string[];

  // Streaming state
  streamingStatus: StreamingStatus;
  streamingHoles: (HoleStrategy | null)[];
  streamingMeta: { pre_round_talk: string; projected_score: number; driver_holes: number[]; par_chance_holes: number[] } | null;

  // Custom course (not in DB)
  isCustomCourse: boolean;
  customCourseName: string | null;
  customCourseTeeName: string | null;
  customCourseDescription: string | null;
  customCourseCity: string | null;
  customCourseState: string | null;

  holesCount: 9 | 18;
  holesStart: 0 | 9;

  // Actions
  setCourse: (course: Course) => void;
  setTee: (tee: string) => void;
  setHoleSelection: (count: 9 | 18, start: 0 | 9) => void;
  setRoundDetails: (date: string, time: string, goal: string) => void;
  setPlaybook: (playbook: Playbook) => void;
  setScore: (holeIndex: number, score: number | null) => void;
  setCurrentHole: (hole: number) => void;
  setCompetitionMode: (v: boolean) => void;
  setHoleNote: (holeIndex: number, note: string) => void;
  setCustomCourse: (name: string, tee: string, description: string, city?: string, state?: string) => void;
  setStreamingStatus: (status: StreamingStatus) => void;
  addStreamingHole: (hole: HoleStrategy) => void;
  setStreamingMeta: (meta: { pre_round_talk: string; projected_score: number; driver_holes: number[]; par_chance_holes: number[] } | null) => void;
  hydrate: () => Promise<void>;
  reset: () => void;
}

const initialState: PersistedRoundState = {
  selectedCourse: null,
  selectedTee: null,
  roundDate: null,
  teeTime: null,
  scoringGoal: null,
  playbook: null,
  scores: Array(18).fill(null) as (number | null)[],
  currentHole: 0,
  holesCount: 18 as 9 | 18,
  holesStart: 0 as 0 | 9,
  isCompetitionMode: false,
  streamingStatus: 'idle' as StreamingStatus,
  streamingHoles: Array(18).fill(null) as (HoleStrategy | null)[],
  streamingMeta: null as { pre_round_talk: string; projected_score: number; driver_holes: number[]; par_chance_holes: number[] } | null,
  holeNotes: Array(18).fill('') as string[],
  isCustomCourse: false,
  customCourseName: null,
  customCourseTeeName: null,
  customCourseDescription: null,
  customCourseCity: null,
  customCourseState: null,
};

function createPersistedSnapshot(state: RoundState): PersistedRoundState {
  return {
    selectedCourse: state.selectedCourse,
    selectedTee: state.selectedTee,
    roundDate: state.roundDate,
    teeTime: state.teeTime,
    scoringGoal: state.scoringGoal,
    playbook: state.playbook,
    scores: state.scores,
    currentHole: state.currentHole,
    isCompetitionMode: state.isCompetitionMode,
    holeNotes: state.holeNotes,
    streamingStatus: state.streamingStatus,
    streamingHoles: state.streamingHoles,
    streamingMeta: state.streamingMeta,
    isCustomCourse: state.isCustomCourse,
    customCourseName: state.customCourseName,
    customCourseTeeName: state.customCourseTeeName,
    customCourseDescription: state.customCourseDescription,
    customCourseCity: state.customCourseCity,
    customCourseState: state.customCourseState,
    holesCount: state.holesCount,
    holesStart: state.holesStart,
  };
}

async function persistRoundState(state: RoundState): Promise<void> {
  try {
    await SecureStore.setItemAsync(ROUND_STATE_KEY, JSON.stringify(createPersistedSnapshot(state)));
  } catch {
    // Non-fatal: round scoring still works without persistence.
  }
}

function updateAndPersist(
  set: (partial: Partial<RoundState> | ((state: RoundState) => Partial<RoundState>)) => void,
  partial: Partial<RoundState> | ((state: RoundState) => Partial<RoundState>)
) {
  set((state) => {
    const patch = typeof partial === 'function' ? partial(state) : partial;
    const nextState = { ...state, ...patch } as RoundState;
    void persistRoundState(nextState);
    return patch;
  });
}

export const useRoundStore = create<RoundState>((set) => ({
  ...initialState,

  setCourse: (course) => updateAndPersist(set, { selectedCourse: course }),
  setTee: (tee) => updateAndPersist(set, { selectedTee: tee }),
  setHoleSelection: (count, start) => updateAndPersist(set, { holesCount: count, holesStart: start, currentHole: 0 }),
  setRoundDetails: (date, time, goal) =>
    updateAndPersist(set, { roundDate: date, teeTime: time, scoringGoal: goal }),
  setPlaybook: (playbook) => updateAndPersist(set, { playbook, streamingStatus: 'done' }),
  setScore: (holeIndex, score) =>
    updateAndPersist(set, (state) => {
      const scores = [...state.scores];
      scores[holeIndex] = score;
      return { scores };
    }),
  setCurrentHole: (hole) => updateAndPersist(set, { currentHole: hole }),
  setCompetitionMode: (v) => updateAndPersist(set, { isCompetitionMode: v }),
  setHoleNote: (holeIndex, note) =>
    updateAndPersist(set, (state) => {
      const holeNotes = [...state.holeNotes];
      holeNotes[holeIndex] = note;
      return { holeNotes };
    }),
  setStreamingStatus: (status) => updateAndPersist(set, { streamingStatus: status }),
  addStreamingHole: (hole) =>
    updateAndPersist(set, (state) => {
      const streamingHoles = [...state.streamingHoles];
      const idx = hole.hole_number - 1;
      streamingHoles[idx] = hole;
      return { streamingHoles };
    }),
  setStreamingMeta: (meta) => updateAndPersist(set, { streamingMeta: meta }),
  setCustomCourse: (name, tee, description, city, state_) =>
    updateAndPersist(set, {
      isCustomCourse: true,
      customCourseName: name,
      customCourseTeeName: tee,
      customCourseDescription: description,
      customCourseCity: city ?? null,
      customCourseState: state_ ?? null,
      selectedCourse: null,
      selectedTee: tee,
    }),
  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(ROUND_STATE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PersistedRoundState>;
      set((state) => ({
        ...state,
        ...initialState,
        ...parsed,
        scores: Array.isArray(parsed.scores) && parsed.scores.length === 18 ? parsed.scores : initialState.scores,
        holeNotes: Array.isArray(parsed.holeNotes) && parsed.holeNotes.length === 18 ? parsed.holeNotes : initialState.holeNotes,
        streamingHoles: Array.isArray(parsed.streamingHoles) && parsed.streamingHoles.length === 18 ? parsed.streamingHoles : initialState.streamingHoles,
        currentHole: typeof parsed.currentHole === 'number' ? parsed.currentHole : 0,
        holesCount: parsed.holesCount === 9 ? 9 : 18,
        holesStart: parsed.holesStart === 9 ? 9 : 0,
      }));
    } catch {
      // Ignore corrupt persisted round state.
    }
  },
  reset: () => {
    set(initialState);
    void SecureStore.deleteItemAsync(ROUND_STATE_KEY).catch(() => {});
  },
}));
