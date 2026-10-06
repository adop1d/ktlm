export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Task {
  id: number;
  title: string;
  description?: string;
  completed: boolean;
  priority: TaskPriority;
  dueDate?: string;
  sortOrder: number;
  createdAt: string; // ISO string from backend
  updatedAt: string;
}

export type TaskSort = 'file' | 'priority' | 'due' | 'newest' | 'oldest' | 'alphabetical';

export type TaskFilter = 'all' | 'active' | 'completed';

/** Parámetros de paginación/filtrado/orden que acepta GET /api/tasks. */
export interface TaskQueryParams {
  page?: number;
  size?: number;
  filter?: TaskFilter;
  q?: string;
  sort?: TaskSort;
  project?: string;
  context?: string;
}

export interface TaskPage {
  content: Task[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface TaskCounts {
  all: number;
  active: number;
  completed: number;
}
