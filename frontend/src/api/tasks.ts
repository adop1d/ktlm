import { API_BASE, fetchJSON } from './http';
import { Task } from '../types/task';

const BASE = `${API_BASE}/api/tasks`;

export const getTasks = () => fetchJSON<Task[]>(BASE);
export const getTask = (id: number) => fetchJSON<Task>(`${BASE}/${id}`);
export const createTask = (task: Partial<Task>) =>
  fetchJSON<Task>(BASE, { method: 'POST', body: JSON.stringify(task) });
export const updateTask = (id: number, task: Partial<Task>) =>
  fetchJSON<Task>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(task) });
export const deleteTask = (id: number) =>
  fetchJSON<void>(`${BASE}/${id}`, { method: 'DELETE' });
export const toggleTask = (id: number) =>
  fetchJSON<Task>(`${BASE}/${id}/toggle`, { method: 'PATCH' });