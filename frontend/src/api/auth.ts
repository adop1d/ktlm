import { API_BASE, fetchPublicJSON } from './http';

export interface AuthResponse {
  token: string;
  type: string;
  username: string;
  email: string;
  roles: string[];
}

export const login = (username: string, password: string) =>
  fetchPublicJSON<AuthResponse>(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });

export const register = (username: string, email: string, password: string) =>
  fetchPublicJSON<AuthResponse>(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  });