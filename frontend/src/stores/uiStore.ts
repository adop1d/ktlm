import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Cómo se ve. Todo lo que tuxeda cambia con una tecla vive aquí, y persiste: un tema que se
 * pierde al recargar es un tema que no existe.
 */

export const THEMES = ['noir', 'dawn', 'muted-slate', 'nord', 'catppuccin', 'gruvbox'] as const;
export type Theme = (typeof THEMES)[number];

export const DENSITIES = ['compact', 'comfortable', 'cozy'] as const;
export type Density = (typeof DENSITIES)[number];

/** dawn es el único claro. Los demás son oscuros, así que llegar a ellos enciende el modo. */
export const THEME_DARK: Record<Theme, boolean> = {
  noir: true,
  dawn: false,
  'muted-slate': true,
  nord: true,
  catppuccin: true,
  gruvbox: true,
};

export const THEME_LABELS: Record<Theme, string> = {
  noir: 'noir',
  dawn: 'dawn',
  'muted-slate': 'muted slate',
  nord: 'nord',
  catppuccin: 'catppuccin',
  gruvbox: 'gruvbox',
};

interface UIState {
  darkMode: boolean;
  toggleDarkMode: () => void;

  theme: Theme;
  cycleTheme: () => void;
  setTheme: (theme: Theme) => void;

  density: Density;
  cycleDensity: () => void;

  lineNumbers: boolean;
  toggleLineNumbers: () => void;
}

const siguiente = <T,>(lista: readonly T[], actual: T): T =>
  lista[(lista.indexOf(actual) + 1) % lista.length];

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Una terminal es oscura de serie. El toggle sigue ahí para quien prefiera claro.
      darkMode: true,
      toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),

      theme: 'noir',
      // Cambiar de tema arrastra el modo: pedir dawn sobre un fondo oscuro daría un tema
      // claro con sombras de oscuro, que es peor que no tener temas.
      cycleTheme: () => set(state => {
        const theme = siguiente(THEMES, state.theme);
        return { theme, darkMode: THEME_DARK[theme] };
      }),
      setTheme: (theme) => set({ theme, darkMode: THEME_DARK[theme] }),

      density: 'comfortable',
      cycleDensity: () => set({ density: siguiente(DENSITIES, get().density) }),

      lineNumbers: false,
      toggleLineNumbers: () => set(state => ({ lineNumbers: !state.lineNumbers })),
    }),
    { name: 'ui-store' }
  )
);