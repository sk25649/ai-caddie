import { create } from 'zustand';
import type { Playbook, Course } from '../lib/api';

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

  // Actions
  setCourse: (course: Course) => void;
  setTee: (tee: string) => void;
  setRoundDetails: (date: string, time: string, goal: string) => void;
  setPlaybook: (playbook: Playbook) => void;
  setScore: (holeIndex: number, score: number | null) => void;
  setCurrentHole: (hole: number) => void;
  setCompetitionMode: (v: boolean) => void;
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
  isCompetitionMode: false,
};

export const useRoundStore = create<RoundState>((set) => ({
  ...initialState,

  setCourse: (course) => set({ selectedCourse: course }),
  setTee: (tee) => set({ selectedTee: tee }),
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
  reset: () => set(initialState),
}));
