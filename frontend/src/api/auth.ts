import { useAuthStore } from '../stores/authStore';

const API_BASE = 'http://localhost:8080';

const fetchJSON = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const res = await fetch(input, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    if (res.status === 401) {
      useAuthStore.getState().logout();
      throw new Error('Unauthorized');
    }
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return (await res.json()) as T;
};

export interface AuthResponse {
  token: string;
  type: string;
  username: string;
  email: string;
  roles: string[];
}

export const login = (username: string, password: string) =>
  fetchJSON<AuthResponse>(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const register = (username: string, email: string, password: string) =>
  fetchJSON<AuthResponse>(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });