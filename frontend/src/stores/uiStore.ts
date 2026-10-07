import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * How it looks. Everything tuxedo changes with a keypress lives here, and it persists: a
 * theme that is lost on reload is a theme that does not exist.
 */

export const THEMES = ['noir', 'dawn', 'muted-slate', 'nord', 'catppuccin', 'gruvbox'] as const;
export type Theme = (typeof THEMES)[number];

export const DENSITIES = ['compact', 'comfortable', 'cozy'] as const;
export type Density = (typeof DENSITIES)[number];

/** dawn is the only light one. The rest are dark, so switching to them turns the mode on. */
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
      // A terminal is dark by default. The toggle stays for whoever prefers light.
      darkMode: true,
      toggleDarkMode: () => set(state => ({ darkMode: !state.darkMode })),

      theme: 'noir',
      // Switching theme drags the mode along: asking for dawn on a dark background would
      // give a light theme with dark shadows, which is worse than having no themes.
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