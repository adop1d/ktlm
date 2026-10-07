import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE } from '../api/http';
import { useAuthStore } from '../stores/authStore';

/**
 * Listens for account changes and refreshes the list when they arrive, instead of asking
 * every ten seconds.
 *
 * It uses `fetch` with `ReadableStream` rather than `EventSource` because `EventSource`
 * does not support headers, and every request here carries the JWT.
 *
 * Reconnects with growing backoff and, when the window regains focus, refreshes once in
 * case the stream dropped while the tab was in the background.
 */
const MAX_BACKOFF_MS = 15_000;

export const useTaskStream = (): void => {
  const qc = useQueryClient();
  const retryRef = useRef(0);

  useEffect(() => {
    const token = useAuthStore.getState().token;
    if (!token) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const refresh = () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['task-counts'] });
    };

    const connect = async () => {
      controller = new AbortController();
      try {
        const response = await fetch(`${API_BASE}/api/tasks/stream`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);

        retryRef.current = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          buffer += decoder.decode(value, { stream: true });
          // Every SSE event ends in a blank line: only then is it complete.
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';
          for (const chunk of chunks) {
            if (chunk.includes('event:tasks')) refresh();
          }
        }
      } catch {
        // dropping is the normal case, not an error: we reconnect
      }

      if (cancelled) return;
      const wait = Math.min(1000 * 2 ** retryRef.current, MAX_BACKOFF_MS);
      retryRef.current += 1;
      reconnect = setTimeout(connect, wait);
    };

    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    void connect();

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      if (reconnect !== null) clearTimeout(reconnect);
      controller?.abort();
    };
  }, [qc]);
};