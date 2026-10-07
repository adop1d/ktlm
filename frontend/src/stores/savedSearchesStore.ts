import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskFilter, TaskSort } from '../types/task';

/**
 * Saved searches — the equivalent of the `filter.<name>` entries in tuxedo's
 * keybinds.toml.
 *
 * There they are a line of text in a file you edit by hand; here they live in
 * localStorage because the browser's config file is not ours. They are saved per user:
 * the same app serves several accounts in the same browser.
 */

export interface SavedFilter {
  name: string;
  q: string;
  filter: TaskFilter;
  project: string | null;
  context: string | null;
  sort: TaskSort;
}

interface SavedFilterState {
  byUser: Record<string, SavedFilter[]>;
  save: (user: string, filter: SavedFilter) => void;
  remove: (user: string, name: string) => void;
  rename: (user: string, from: string, to: string) => void;
}

/** An empty filter is not a search: saving it only adds noise to the list. */
export const isEmptyFilter = (filter: Omit<SavedFilter, 'name'>): boolean =>
  filter.q.trim() === '' &&
  filter.filter === 'all' &&
  filter.project === null &&
  filter.context === null;

export const useSavedFilters = create<SavedFilterState>()(
  persist(
    set => ({
      byUser: {},

      save: (user, filter) =>
        set((state) => {
          const existing = state.byUser[user] ?? [];
          const sameName = existing.filter((item) => item.name === filter.name);
          return {
            byUser: {
              ...state.byUser,
              // Saving twice under the same name overwrites, as in the TOML: the repeated
              // key keeps the last value.
              [user]: [...sameName, filter],
            },
          };
        }),

      remove: (user, name) =>
        set((state) => ({
          byUser: {
            ...state.byUser,
            [user]: (state.byUser[user] ?? []).filter((item) => item.name !== name),
          },
        })),

      rename: (user, from, to) =>
        set((state) => ({
          byUser: {
            ...state.byUser,
            [user]: (state.byUser[user] ?? []).map((item) =>
              item.name === from ? { ...item, name: to } : item
            ),
          },
        })),
    }),
    { name: 'saved-filters' }
  )
);
