import { create } from 'zustand';
import type { Playbook, Course, HoleStrategy } from '../lib/api';

type StreamingStatus = 'idle' | 'streaming' | 'done' | 'error';

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
  reset: () => void;
}

const initialState = {
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

export const useRoundStore = create<RoundState>((set) => ({
  ...initialState,

  setCourse: (course) => set({ selectedCourse: course }),
  setTee: (tee) => set({ selectedTee: tee }),
  setHoleSelection: (count, start) => set({ holesCount: count, holesStart: start, currentHole: 0 }),
  setRoundDetails: (date, time, goal) =>
    set({ roundDate: date, teeTime: time, scoringGoal: goal }),
  setPlaybook: (playbook) => set({ playbook }),
  setScore: (holeIndex, score) =>
    set((state) => {
      const scores = [...state.scores];
      scores[holeIndex] = scores[holeIndex] === score ? null : score;
      return { scores };
    }),
  setCurrentHole: (hole) => set({ currentHole: hole }),
  setCompetitionMode: (v) => set({ isCompetitionMode: v }),
  setHoleNote: (holeIndex, note) =>
    set((state) => {
      const holeNotes = [...state.holeNotes];
      holeNotes[holeIndex] = note;
      return { holeNotes };
    }),
  setStreamingStatus: (status) => set({ streamingStatus: status }),
  addStreamingHole: (hole) =>
    set((state) => {
      const streamingHoles = [...state.streamingHoles];
      const idx = hole.hole_number - 1;
      streamingHoles[idx] = hole;
      return { streamingHoles };
    }),
  setStreamingMeta: (meta) => set({ streamingMeta: meta }),
  setCustomCourse: (name, tee, description, city, state_) =>
    set({
      isCustomCourse: true,
      customCourseName: name,
      customCourseTeeName: tee,
      customCourseDescription: description,
      customCourseCity: city ?? null,
      customCourseState: state_ ?? null,
      selectedCourse: null,
      selectedTee: tee,
    }),
  reset: () => set(initialState),
}));
