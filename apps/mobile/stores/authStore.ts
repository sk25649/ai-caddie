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
    try {
      // Auto-logout on 401 (expired token)
      api.setOnUnauthorized(() => {
        const { logout } = useAuthStore.getState();
        logout();
      });

      const token = await SecureStore.getItemAsync('auth_token');
      const userId = await SecureStore.getItemAsync('auth_user_id');
      if (token && userId) {
        api.setToken(token);
        set({ token, userId, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      // SecureStore corrupted — clear it and let user re-login
      try {
        await SecureStore.deleteItemAsync('auth_token');
        await SecureStore.deleteItemAsync('auth_user_id');
      } catch {
        // Nothing we can do
      }
      set({ isLoading: false });
    }
  },

  setAuth: (token: string, userId: string) => {
    api.setToken(token);
    SecureStore.setItemAsync('auth_user_id', userId).catch(() => {});
    set({ token, userId, isAuthenticated: true });
  },

  logout: async () => {
    api.setToken(null);
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user_id');
    } catch {
      // Best-effort cleanup
    }
    set({ token: null, userId: null, isAuthenticated: false });
  },
}));
