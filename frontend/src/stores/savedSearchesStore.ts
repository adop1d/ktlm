import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TaskFilter, TaskSort } from '../types/task';

/**
 * Búsquedas guardadas — el equivalente a los `filter.<nombre>` del keybinds.toml de tuxedo.
 *
 * Allá son una línea de texto en un fichero que se edita a mano; aquí viven en localStorage
 * porque el archivo de configuración del navegador no es nuestro. Se guardan por usuario:
 * la misma app sirve a varias cuentas en el mismo navegador.
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

/** Un filtro vacío no es una búsqueda: guardarlo solo añade ruido a la lista. */
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
              // Guardar dos veces con el mismo nombre sobrescribe, como en el TOML: la clave
              // repetida se queda con el último valor.
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
