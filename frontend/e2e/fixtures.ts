import { Page, expect, test as base } from '@playwright/test';

/**
 * Los e2e interceptan la API en vez de hablar con un backend de verdad. Es lo que los hace
 * herméticos y, sobre todo, lo que hace que una aserción rota **falle** en lugar de
 * deslizarse por un `if (isVisible())`.
 */

export interface SeedTask {
  id: number;
  title: string;
  description?: string;
  completed?: boolean;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  dueDate?: string;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
  recurrence?: string | null;
  threshold?: string | null;
  todoUid?: string | null;
  projects?: string[];
  contexts?: string[];
}

export const seedTasks = (count: number, prefix = 'Tarea'): SeedTask[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    title: `${prefix} ${String(index + 1).padStart(3, '0')}`,
    // Una de cada cinco llega completada: el filtro de pestañas necesita dónde mirar.
    completed: index % 5 === 0,
    priority: index % 7 === 0 ? 'HIGH' : index % 3 === 0 ? 'LOW' : 'MEDIUM',
    dueDate: index % 2 === 0 ? '2026-12-01' : undefined,
    sortOrder: index,
    createdAt: `2026-10-0${(index % 9) + 1}T09:00:00`,
    updatedAt: '2026-10-01T09:00:00',
    recurrence: null,
    threshold: null,
    todoUid: String(index + 1),
    projects: [],
    contexts: [],
  }));

export interface ApiState {
  tasks: SeedTask[];
}

/** Intercepta /api/tasks con un conjunto en memoria. */
export const mockTasks = async (page: Page, state: ApiState): Promise<void> => {
  // Predicado de ruta y no glob: `**/api/tasks**` también capturaba el módulo del propio
  // dev server (/src/api/tasks.ts) y lo sustituía por un `{}` que dejaba la app en blanco.
  await page.route((url) => url.pathname.startsWith('/api/tasks'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.endsWith('/counts')) {
      const total = state.tasks.length;
      const completed = state.tasks.filter((task) => task.completed).length;
      return route.fulfill({ json: { all: total, active: total - completed, completed } });
    }

    if (method === 'GET') {
      const wanted = Number(url.searchParams.get('page') ?? '0');
      const size = Number(url.searchParams.get('size') ?? '20');
      const filter = url.searchParams.get('filter') ?? 'all';
      const term = (url.searchParams.get('q') ?? '').trim().toLowerCase();

      // Sin esto el mock miente: devolvería la lista entera y los filtros pasarían sin
      // probar nada, que es justo lo que hacen las aserciones condicionales.
      let visible = state.tasks;
      if (filter === 'active') visible = visible.filter((task) => !task.completed);
      if (filter === 'completed') visible = visible.filter((task) => task.completed);
      if (term) {
        visible = visible.filter(
          (task) =>
            task.title.toLowerCase().includes(term) ||
            task.description?.toLowerCase().includes(term)
        );
      }

      return route.fulfill({
        json: {
          content: visible.slice(wanted * size, wanted * size + size),
          page: wanted,
          size,
          totalElements: visible.length,
          totalPages: Math.max(1, Math.ceil(visible.length / size)),
          hasNext: (wanted + 1) * size < visible.length,
          hasPrevious: wanted > 0,
        },
      });
    }

    if (method === 'POST' && url.pathname.endsWith('/api/tasks')) {
      const body = request.postDataJSON() as Partial<SeedTask>;
      const created: SeedTask = {
        ...body,
        id: state.tasks.length + 1,
        completed: body.completed ?? false,
        priority: body.priority ?? 'MEDIUM',
        sortOrder: state.tasks.length,
        createdAt: '2026-10-06T09:00:00',
        updatedAt: '2026-10-06T09:00:00',
        projects: body.projects ?? [],
        contexts: body.contexts ?? [],
      };
      state.tasks = [...state.tasks, created];
      return route.fulfill({ status: 201, json: created });
    }

    const taskId = Number(url.pathname.split('/').pop());
    const target = state.tasks.find((task) => task.id === taskId);
    if (!target) return route.fulfill({ status: 404, json: { error: 'Not Found' } });

    if (method === 'PUT') {
      Object.assign(target, request.postDataJSON());
      return route.fulfill({ json: target });
    }
    if (method === 'DELETE') {
      state.tasks = state.tasks.filter((task) => task.id !== taskId);
      return route.fulfill({ status: 204 });
    }
    if (method === 'PATCH') {
      target.completed = !target.completed;
      return route.fulfill({ json: target });
    }
    return route.fulfill({ status: 405 });
  });
};

const seedSession = (page: Page, token = 'fake-jwt') =>
  page.addInitScript((value) => {
    window.localStorage.setItem(
      'auth-store',
      JSON.stringify({
        state: { token: value, username: 'tester', email: 't@t.com', roles: ['ROLE_USER'] },
        version: 0,
      })
    );
  }, token);

/** Test con la API de tareas simulada y la sesión ya sembrada. */
export const test = base.extend<{ api: ApiState }>({
  // auto: sin esto el fixture solo se monta si algún test lo pide por nombre, y casi ninguno
  // lo hace. La sesión y los mocks se aplicaban solo a los que lo destructuraban, y el
  // resto navegaba contra el backend real de verdad.
  api: [
    async ({ page }, use) => {
      const state: ApiState = { tasks: seedTasks(3) };
      await mockTasks(page, state);
      await seedSession(page);
      await use(state);
    },
    { auto: true },
  ],
});

export { expect, seedSession };

/** Espera a que la lista esté pintada: el skeleton es el estado de carga real. */
export const waitForList = async (page: Page) => {
  await expect(page.getByRole('heading', { name: 'Mis tareas' })).toBeVisible();
};