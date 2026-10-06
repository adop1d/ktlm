import { API_BASE, fetchJSON } from './http';
import { useAuthStore } from '../stores/authStore';

const authHeader = (): Record<string, string> => {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
import { Task, TaskCounts, TaskPage, TaskQueryParams } from '../types/task';

const BASE = `${API_BASE}/api/tasks`;

const DEFAULTS = { page: 0, size: 20, filter: 'all', sort: 'file' } as const;

/** Los defaults no viajan: mantiene la URL y la cache key limpias. */
export const getTasks = (params: TaskQueryParams = {}) => {
  const qs = new URLSearchParams();
  if (params.page !== undefined && params.page !== DEFAULTS.page) qs.set('page', String(params.page));
  if (params.size !== undefined && params.size !== DEFAULTS.size) qs.set('size', String(params.size));
  if (params.filter !== undefined && params.filter !== DEFAULTS.filter) qs.set('filter', params.filter);
  if (params.sort !== undefined && params.sort !== DEFAULTS.sort) qs.set('sort', params.sort);
  if (params.q?.trim()) qs.set('q', params.q.trim());
  if (params.project) qs.set('project', params.project);
  if (params.context) qs.set('context', params.context);
  const query = qs.toString();
  return fetchJSON<TaskPage>(query ? `${BASE}?${query}` : BASE);
};
export const getTaskCounts = () => fetchJSON<TaskCounts>(`${BASE}/counts`);
export const getTask = (id: number) => fetchJSON<Task>(`${BASE}/${id}`);
export const createTask = (task: Partial<Task>) =>
  fetchJSON<Task>(BASE, { method: 'POST', body: JSON.stringify(task) });
export const updateTask = (id: number, task: Partial<Task>) =>
  fetchJSON<Task>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(task) });
export const deleteTask = (id: number) =>
  fetchJSON<void>(`${BASE}/${id}`, { method: 'DELETE' });
export const toggleTask = (id: number) =>
  fetchJSON<Task>(`${BASE}/${id}/toggle`, { method: 'PATCH' });

export interface TodoImportResult {
  imported: number;
  updated: number;
  parsed: number;
  file: string;
}

/** POST text/plain: el backend no admite JSON aquí porque el archivo es texto crudo. */
export const importTodoFile = (content: string) =>
  // El endpoint consume text/plain: el Content-Type por defecto del helper sería json y
  // el servidor lo rechazaría por tipo de medio.
  fetchJSON<TodoImportResult>(`${BASE}/import`, {
    method: 'POST',
    body: content,
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
  });

export const exportTodoFile = (token: string | null) =>
  fetch(`${API_BASE}/api/tasks/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then((res) => {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.text();
  });

/**
 * El archivo del servidor, como texto. Lo crea si no existía. No se parsea como JSON
 * porque es un archivo, no una respuesta de API.
 */
export const readTodoFile = (): Promise<string> =>
  fetch(`${API_BASE}/api/tasks/file`, { headers: authHeader() }).then(async (res) => {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.text();
  });

/** Reemplaza el archivo entero y devuelve la versión reconciliada, con los uid ya puestos. */
export const replaceTodoFile = (content: string) =>
  fetch(`${API_BASE}/api/tasks/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain', ...authHeader() },
    body: content,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.text();
  });

/** Lo que hay en done.txt, ahora servido por el servidor. */
export const readArchived = () => fetchJSON<string[]>(`${BASE}/archived`);

export const archiveCompleted = () =>
  fetchJSON<{ archived: number; doneFile: string }>(`${BASE}/archive`, { method: 'POST' });