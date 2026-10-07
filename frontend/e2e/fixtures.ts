import { Page, expect, test as base } from '@playwright/test';

/**
 * The e2e intercept the API instead of talking to a real backend. That is what makes them
 * hermetic and, above all, what makes a broken assertion **fail** instead of
 * sliding past an `if (isVisible())`.
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
    // One in five arrives completed: the tab filter needs something to look at.
    completed: index % 5 === 0,
    priority: index % 7 === 0 ? 'HIGH' : index % 3 === 0 ? 'LOW' : 'MEDIUM',
    dueDate: index % 2 === 0 ? '2026-12-01' : undefined,
    sortOrder: index,
    createdAt: `2026-10-0${(index % 9) + 1}T09:00:00`,
    updatedAt: '2026-10-01T09:00:00',
    recurrence: null,
    threshold: null,
    todoUid: String(index + 1),
    // One in two carries a project and one in three a context: the filter panel needs
    // somewhere to build the list from.
    projects: index % 2 === 0 ? ['salud'] : ['casa'],
    contexts: index % 3 === 0 ? ['oficina'] : [],
  }));

export interface ApiState {
  tasks: SeedTask[];
}

/** Intercepts /api/tasks with an in-memory dataset. */
export const mockTasks = async (page: Page, state: ApiState): Promise<void> => {
  // A route predicate, not a glob: `**/api/tasks**` also caught the dev server's own
  // module (/src/api/tasks.ts) and replaced it with a `{}` that left the app blank.
  // The stream is excluded on purpose: it is an event stream and the mock would return it
  // page JSON, which is worse than not mocking it at all.
  await page.route(
    (url) => url.pathname.startsWith('/api/tasks') && !url.pathname.endsWith('/stream'),
    async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.endsWith('/counts')) {
      const total = state.tasks.length;
      const completed = state.tasks.filter((task) => task.completed).length;
      return route.fulfill({ json: { all: total, active: total - completed, completed } });
    }

    // done.txt and todo.txt are not the task list. Without this they fall into the branch
    // below and return a page object where an array or text is expected, which blows up
    // the render instead of failing the assertion.
    if (url.pathname.endsWith('/archived')) {
      return route.fulfill({ json: [] as string[] });
    }
    if (url.pathname.endsWith('/file')) {
      const body = state.tasks.map((task) => `${task.title} uid:${task.id}`).join('\n');
      return route.fulfill({ status: 200, contentType: 'text/plain', body });
    }
    if (url.pathname.endsWith('/note')) {
      if (method === 'GET') return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
      return route.fulfill({ json: { ok: true, vacia: !(request.postData() ?? '').trim() } });
    }

    if (method === 'GET') {
      const wanted = Number(url.searchParams.get('page') ?? '0');
      const size = Number(url.searchParams.get('size') ?? '20');
      const filter = url.searchParams.get('filter') ?? 'all';
      const term = (url.searchParams.get('q') ?? '').trim().toLowerCase();
      const project = url.searchParams.get('project');
      const context = url.searchParams.get('context');

      // Without this the mock lies: it would return the whole list and the filters would pass
      // without testing anything, which is exactly what conditional assertions do.
      let visible = state.tasks;
      if (filter === 'active') visible = visible.filter((task) => !task.completed);
      if (filter === 'completed') visible = visible.filter((task) => task.completed);
      if (project) visible = visible.filter((task) => task.projects?.includes(project));
      if (context) visible = visible.filter((task) => task.contexts?.includes(context));
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

/** Test with the task API mocked and the session already seeded. */
export const test = base.extend<{ api: ApiState }>({
  // auto: without it the fixture is only set up if some test asks for it by name, and almost none
  // do. The session and the mocks only applied to the ones that destructured it, and the rest
  // navigated against the real backend for real.
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

/**
 * Waits until the list is painted. It anchors on the grid, not on a title: the title can
 * change without the app being broken, and the failure that matters is "the list never came".
 */
export const waitForList = async (page: Page) => {
  await expect(page.locator('.tui-titlebar')).toBeVisible();
  // The title bar shows even with an empty list, so that is not enough: wait for the list
  // to settle, either with rows or with the empty state. Without this, a navigation key can
  // arrive before there are rows to move.
  await page.waitForFunction(
    () => document.querySelectorAll('.tui-row').length > 0 ||
      (document.body.innerText.includes('No hay tareas') ||
        document.body.innerText.includes('No hay resultados'))
  );
};