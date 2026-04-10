import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  username: string | null;
  email: string | null;
  roles: string[];
  setAuth: (token: string, username: string, email: string, roles: string[]) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      username: null,
      email: null,
      roles: [],
      setAuth: (token, username, email, roles) => set({ token, username, email, roles }),
      logout: () => set({ token: null, username: null, email: null, roles: [] }),
      isAuthenticated: () => !!get().token,
      hasRole: (role: string) => get().roles.includes(role),
    }),
    { name: 'auth-store' }
  )
);