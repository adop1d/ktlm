import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTasks } from '../useTasks';
import { vi, describe, test, expect, beforeEach } from 'vitest';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTasks hook', () => {
  test('renders without crashing', async () => {
    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    });

    // Just verify the hook renders
    expect(result.current).toBeDefined();
    expect(result.current.tasks).toBeUndefined();
  });
});
