import { useAuthStore } from '../stores/authStore';

/** Backend base. Overridden with VITE_API_URL in .env */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const parseError = async (res: Response): Promise<Error> => {
  // 401 and 403 mean the same thing to the client: the token it carries is no good. That
  // happens with an expired JWT, and also when the signing key changes —an environment
  // variable— and every token issued before it stops working all at once.
  //
  // Before, only 401 logged you out, so that second case left the app stuck on a
  // permanent «Error al cargar: 403»: the session looked alive, with the username at the
  // top, and no request went through.
  if (res.status === 401 || res.status === 403) {
    useAuthStore.getState().logout();
    return new Error(res.status === 401 ? 'Unauthorized' : 'Forbidden');
  }
  const body = await res.text();
  return new Error(`API error ${res.status}: ${body}`);
};

/** Fetch JSON with the JWT from the store. */
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

/** Same as fetchJSON but without attaching the token (login / register). */
export const fetchPublicJSON = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
};