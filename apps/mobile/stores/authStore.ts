import { create } from 'zustand';
import { api } from '../lib/api';
import * as SecureStore from 'expo-secure-store';

interface AuthState {
  token: string | null;
  userId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  init: () => Promise<void>;
  setAuth: (token: string, userId: string) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  userId: null,
  isLoading: true,
  isAuthenticated: false,

  init: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    const userId = await SecureStore.getItemAsync('auth_user_id');
    if (token && userId) {
      api.setToken(token);
      set({ token, userId, isAuthenticated: true, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },

  setAuth: (token: string, userId: string) => {
    api.setToken(token);
    SecureStore.setItemAsync('auth_user_id', userId);
    set({ token, userId, isAuthenticated: true });
  },

  logout: async () => {
    api.setToken(null);
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('auth_user_id');
    set({ token: null, userId: null, isAuthenticated: false });
  },
}));
