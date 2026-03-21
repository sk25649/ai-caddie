import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  details?: unknown;
}

class ApiClient {
  private token: string | null = null;

  async init(): Promise<void> {
    this.token = await SecureStore.getItemAsync('auth_token');
  }

  setToken(token: string | null): void {
    this.token = token;
    if (token) {
      SecureStore.setItemAsync('auth_token', token);
    } else {
      SecureStore.deleteItemAsync('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const json = await res.json();

    if (!res.ok) {
      throw new ApiError(json.error || 'Request failed', res.status, json.details);
    }

    return json;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.request<T>(path);
    return res.data as T;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return res.data as T;
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await this.request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    return res.data as T;
  }
}

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export const api = new ApiClient();

// ============ AUTH ============

interface AuthResponse {
  token: string;
  userId: string;
}

export async function signup(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/signup', { email, password });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', { email, password });
}

export async function appleSignIn(appleId: string, email?: string, fullName?: string): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/apple', { appleId, email, fullName });
}

// ============ PROFILE ============

export interface PlayerClub {
  id: string;
  clubName: string;
  clubType: string;
  carryDistance: number | null;
  totalDistance: number | null;
  isFairwayFinder: boolean | null;
  notes: string | null;
  sortOrder: number | null;
}

export interface PlayerProfile {
  id: string;
  userId: string;
  displayName: string | null;
  handicap: string | null;
  stockShape: string | null;
  missPrimary: string | null;
  missSecondary: string | null;
  missDescription: string | null;
  dreamScore: number | null;
  goalScore: number | null;
  floorScore: number | null;
  clubs: PlayerClub[];
}

export async function getProfile(): Promise<PlayerProfile> {
  return api.get<PlayerProfile>('/profile');
}

export async function updateProfile(data: Partial<PlayerProfile>): Promise<PlayerProfile> {
  return api.put<PlayerProfile>('/profile', data);
}

export async function updateClubs(clubs: Omit<PlayerClub, 'id'>[]): Promise<PlayerClub[]> {
  return api.put<PlayerClub[]>('/profile/clubs', { clubs });
}

// ============ COURSES ============

export interface TeeInfo {
  name: string;
  color: string;
  totalYardage: number;
  rating: number;
  slope: number;
}

export interface Course {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
  par: number;
  tees: TeeInfo[];
}

export interface CourseDetail extends Course {
  zip: string | null;
  latitude: string | null;
  longitude: string | null;
  courseIntel: Record<string, string> | null;
  isActive: boolean | null;
}

export interface HoleData {
  id: string;
  courseId: string;
  holeNumber: number;
  par: number;
  handicapIndex: number | null;
  yardages: Record<string, number>;
  holeIntel: Record<string, unknown>;
}

export async function getCourses(query?: string): Promise<Course[]> {
  const q = query ? `?q=${encodeURIComponent(query)}` : '';
  return api.get<Course[]>(`/courses${q}`);
}

export async function getCourse(slug: string): Promise<CourseDetail> {
  return api.get<CourseDetail>(`/courses/${slug}`);
}

export async function getCourseHoles(slug: string): Promise<{ course: CourseDetail; holes: HoleData[] }> {
  return api.get<{ course: CourseDetail; holes: HoleData[] }>(`/courses/${slug}/holes`);
}

// ============ PLAYBOOK ============

export interface HoleStrategy {
  hole_number: number;
  handicap_index?: number;
  yardage: number;
  par: number;
  tee_club: string;
  // Structured fields (new playbooks)
  aim_point?: string;
  carry_target?: number;
  play_bullets?: string[];
  terrain_note?: string;
  // Legacy fields (kept for backward compat with cached playbooks)
  strategy?: string;
  scoring_mindset?: string;
  miss_left: string;
  miss_right: string;
  miss_short: string;
  danger: string;
  target: string;
  is_par_chance: boolean;
  do_this?: string[];
  dont_do?: string[];
  approach_club?: string;
  approach_distance?: number;
}

export interface Playbook {
  id: string;
  profileId: string;
  courseId: string;
  teeName: string;
  scoringGoal: string | null;
  weatherConditions: Record<string, unknown> | null;
  roundDate: string | null;
  teeTime: string | null;
  preRoundTalk: string | null;
  holeStrategies: HoleStrategy[];
  projectedScore: number | null;
  driverHoles: number[] | null;
  parChanceHoles: number[] | null;
  generatedAt: string | null;
}

export interface GeneratePlaybookParams {
  courseId: string;
  teeName: string;
  roundDate: string;
  teeTime: string;
  scoringGoal: string;
}

export async function generatePlaybook(params: GeneratePlaybookParams): Promise<Playbook> {
  return api.post<Playbook>('/playbook/generate', params);
}

export async function getPlaybook(id: string): Promise<Playbook> {
  return api.get<Playbook>(`/playbook/${id}`);
}

// ============ ROUNDS ============

export interface RoundScore {
  id: string;
  profileId: string;
  playbookId: string | null;
  courseId: string | null;
  roundDate: string | null;
  teeName: string | null;
  holeScores: number[] | null;
  totalScore: number | null;
  notes: string | null;
  createdAt: string | null;
}

export interface SaveRoundParams {
  playbookId?: string;
  courseId: string;
  roundDate: string;
  teeName: string;
  holeScores: number[];
  totalScore: number;
  notes?: string;
}

export async function saveRound(params: SaveRoundParams): Promise<RoundScore> {
  return api.post<RoundScore>('/rounds', params);
}

export async function getRounds(): Promise<RoundScore[]> {
  return api.get<RoundScore[]>('/rounds');
}
