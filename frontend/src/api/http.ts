import { useAuthStore } from '../stores/authStore';

/** Base del backend. Se sobreescribe con VITE_API_URL en .env */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const parseError = async (res: Response): Promise<Error> => {
  // 401 y 403 significan lo mismo para el cliente: el token que lleva ya no vale. Pasa
  // con un JWT caducado, y también cuando la clave de firma cambia —una variable de
  // entorno— y todos los tokens emitidos antes dejan de servir de golpe.
  //
  // Antes solo se cerraba sesión con 401, así que ese segundo caso dejaba la app en un
  // «Error al cargar: 403» permanente: la sesión parecía viva, con el nombre del usuario
  // arriba, y ninguna petición pasaba.
  if (res.status === 401 || res.status === 403) {
    useAuthStore.getState().logout();
    return new Error(res.status === 401 ? 'Unauthorized' : 'Forbidden');
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