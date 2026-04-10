import { useAuthStore } from '../stores/authStore';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const fetchWithAuth = async <T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> => {
  const token = useAuthStore.getState().token;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers || {}),
  };

  const res = await fetch(input, { ...init, headers });

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

// Auth calls (no auth required)
export const login = (username: string, password: string) =>
  fetchWithAuth<{ token: string }>(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const register = (username: string, email: string, password: string) =>
  fetchWithAuth<{ token: string }>(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });