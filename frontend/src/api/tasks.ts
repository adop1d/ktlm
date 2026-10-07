import { API_BASE, fetchJSON } from './http';
import { useAuthStore } from '../stores/authStore';

const authHeader = (): Record<string, string> => {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
import { Task, TaskCounts, TaskPage, TaskQueryParams } from '../types/task';

const BASE = `${API_BASE}/api/tasks`;

const DEFAULTS = { page: 0, size: 20, filter: 'all', sort: 'file' } as const;

/** Defaults do not travel: keeps the URL and the cache key clean. */
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

/** POST text/plain: the backend does not accept JSON here because the file is raw text. */
export const importTodoFile = (content: string) =>
  // The endpoint consumes text/plain: the helper's default Content-Type would be json and
  // the server would reject it by media type.
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
 * The file from the server, as text. Creates it if it did not exist. Not parsed as JSON
 * because it is a file, not an API response.
 */
export const readTodoFile = (): Promise<string> =>
  fetch(`${API_BASE}/api/tasks/file`, { headers: authHeader() }).then(async (res) => {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.text();
  });

/** Replaces the whole file and returns the reconciled version, with the uid already set. */
export const replaceTodoFile = (content: string) =>
  fetch(`${API_BASE}/api/tasks/file`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain', ...authHeader() },
    body: content,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.text();
  });

/** What's in done.txt, now served by the backend. */
export const readArchived = () => fetchJSON<string[]>(`${BASE}/archived`);

export const archiveCompleted = () =>
  fetchJSON<{ archived: number; doneFile: string }>(`${BASE}/archive`, { method: 'POST' });
/** The text of a task's note. Empty if it has none. */
export const readNote = (uid: number) =>
  fetch(`${API_BASE}/api/tasks/${uid}/note`, { headers: authHeader() }).then(async (res) => {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.text();
  });

/** Saves the note. Emptying it deletes the file and strips the `note:` token from the line. */
export const writeNote = (uid: number, content: string) =>
  fetch(`${API_BASE}/api/tasks/${uid}/note`, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8', ...authHeader() },
    body: content,
  }).then(async (res) => {
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return res.json();
  });
