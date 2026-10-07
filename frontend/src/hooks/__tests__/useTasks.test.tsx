import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasks } from '../useTasks';
import type { TaskQueryParams } from '../../types/task';
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

const emptyPage = {
  content: [],
  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
  hasPrevious: false,
};

let urls: string[] = [];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTasks hook', () => {
  beforeEach(() => {
    urls = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response(JSON.stringify(emptyPage), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('la query key incluye los params y omite los defaults en la URL', async () => {
    const wrapper = createWrapper();
    const initialProps: { p: TaskQueryParams } = { p: { page: 0, size: 20 } };
    const { result, rerender } = renderHook(({ p }: { p: TaskQueryParams }) => useTasks(p), {
      wrapper,
      initialProps,
    });

    await waitFor(() => expect(result.current.page).toBeDefined());
    await waitFor(() => expect(urls.some(u => u.endsWith('/api/tasks'))).toBe(true));
    expect(urls.find(u => u.endsWith('/api/tasks'))).not.toContain('?');

    rerender({ p: { page: 2, size: 20, filter: 'active', sort: 'priority', q: 'nueva' } });
    await waitFor(() => expect(urls.some(u => u.includes('page=2'))).toBe(true));
    const next = new URL(urls.find(u => u.includes('page=2'))!);
    expect(next.pathname).toBe('/api/tasks');
    expect(next.searchParams.get('page')).toBe('2');
    expect(next.searchParams.get('filter')).toBe('active');
    expect(next.searchParams.get('sort')).toBe('priority');
    expect(next.searchParams.get('q')).toBe('nueva');
    expect(next.searchParams.get('size')).toBeNull();
  });

  test('la query de counts usa su propia key', async () => {
    const { result } = renderHook(() => useTasks({ page: 0 }), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.counts).toBeDefined());
    expect(urls.some(u => u.endsWith('/api/tasks/counts'))).toBe(true);
  });

  test('keepPreviousData conserva la página anterior mientras llega la siguiente', async () => {
    const first = { ...emptyPage, content: [{ id: 1, title: 'a', completed: false, priority: 'LOW' as const, sortOrder: 0, createdAt: '', updatedAt: '' }], totalElements: 40, totalPages: 2, hasNext: true };
    const second = { ...first, content: [{ id: 21, title: 'b', completed: false, priority: 'LOW' as const, sortOrder: 0, createdAt: '', updatedAt: '' }], page: 1, hasNext: false, hasPrevious: true };

    let resolveSecond: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('page=1')) {
        return new Promise<Response>(resolve => { resolveSecond = resolve; });
      }
      return new Response(JSON.stringify(url.includes('counts') ? { all: 40, active: 40, completed: 0 } : first), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    const wrapper = createWrapper();
    const { result, rerender } = renderHook(
      ({ p }: { p: number }) => useTasks({ page: p }),
      { wrapper, initialProps: { p: 0 } },
    );

    await waitFor(() => expect(result.current.page?.content[0]?.id).toBe(1));

    rerender({ p: 1 });
    await waitFor(() => expect(result.current.isFetching).toBe(true));

    // Without keepPreviousData this would be undefined and the list would flicker.
    expect(result.current.page?.content[0]?.id).toBe(1);
    expect(result.current.isLoading).toBe(false);

    resolveSecond(new Response(JSON.stringify(second), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await waitFor(() => expect(result.current.page?.content[0]?.id).toBe(21));
  });
});