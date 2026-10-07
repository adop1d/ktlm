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
  // --- Interoperabilidad con todo.txt ---
  /** Fecha de completado, presente solo en tareas cerradas. */
  completedAt?: string;
  /** Literal del token `rec:` sin el prefijo, p. ej. "+1m". */
  recurrence?: string | null;
  /** Literal del token `t:` sin el prefijo, p. ej. "-3d". */
  threshold?: string | null;
  /** Ruta del archivo de nota, tal cual va en el token `note:`. */
  note?: string | null;
  /** Identidad estable en el archivo, la que hace de clave del round-trip. */
  todoUid?: string | null;
  projects: string[];
  contexts: string[];
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
