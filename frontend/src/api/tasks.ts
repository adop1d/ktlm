import { Task } from '../types/task';
import { useAuthStore } from '../stores/authStore';

const API_BASE = 'http://localhost:8080/api/tasks';

const fetchJSON = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const token = useAuthStore.getState().token;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers || {}),
  };
  const res = await fetch(input, { ...init, headers });
  if (!res.ok) {
    if (res.status === 401) useAuthStore.getState().logout();
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return (await res.json()) as T;
};

export const getTasks = () => fetchJSON<Task[]>(API_BASE);
export const getTask = (id: number) => fetchJSON<Task>(`${API_BASE}/${id}`);
export const createTask = (task: Partial<Task>) =>
  fetchJSON<Task>(API_BASE, { method: 'POST', body: JSON.stringify(task) });
export const updateTask = (id: number, task: Partial<Task>) =>
  fetchJSON<Task>(`${API_BASE}/${id}`, { method: 'PUT', body: JSON.stringify(task) });
export const deleteTask = (id: number) =>
  fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
export const toggleTask = (id: number) =>
  fetchJSON<Task>(`${API_BASE}/${id}/toggle`, { method: 'PATCH' });
