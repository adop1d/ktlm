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
  // --- Interoperability with todo.txt ---
  /** Completion date, present only on closed tasks. */
  completedAt?: string;
  /** Literal of the `rec:` token without the prefix, e.g. "+1m". */
  recurrence?: string | null;
  /** Literal of the `t:` token without the prefix, e.g. "-3d". */
  threshold?: string | null;
  /** Note file path, exactly as it goes in the `note:` token. */
  note?: string | null;
  /** Stable identity in the file, the one that serves as the round-trip key. */
  todoUid?: string | null;
  projects: string[];
  contexts: string[];
}

export type TaskSort = 'file' | 'priority' | 'due' | 'newest' | 'oldest' | 'alphabetical';

export type TaskFilter = 'all' | 'active' | 'completed';

/** Pagination/filter/sort parameters accepted by GET /api/tasks. */
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
