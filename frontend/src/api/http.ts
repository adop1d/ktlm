import { useAuthStore } from '../stores/authStore';

/** Base del backend. Se sobreescribe con VITE_API_URL en .env */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const parseError = async (res: Response): Promise<Error> => {
  if (res.status === 401) {
    useAuthStore.getState().logout();
    return new Error('Unauthorized');
  }
  const body = await res.text();
  return new Error(`API error ${res.status}: ${body}`);
};

/** Fetch JSON con el JWT del store. */
export const fetchJSON = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const token = useAuthStore.getState().token;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

/** Igual que fetchJSON pero sin adjuntar el token (login / register). */
export const fetchPublicJSON = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
};