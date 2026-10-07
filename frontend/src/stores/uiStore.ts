import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * How it looks. Everything tuxedo changes with a keypress lives here, and it persists: a
 * theme that is lost on reload is a theme that does not exist.
 */

export const DEFAULT_ACCENT = '#ff2d92';

/** Enough to start from, and to fall back on. */
export const ACCENT_PRESETS = [
  { name: 'rosa', value: '#ff2d92' },
  { name: 'cian', value: '#00e5ff' },
  { name: 'lima', value: '#b6ff00' },
  { name: 'naranja', value: '#ff6b35' },
  { name: 'violeta', value: '#9d4edd' },
  { name: 'ámbar', value: '#fabd2f' },
  { name: 'menta', value: '#4ade80' },
  { name: 'azul', value: '#60a5fa' },
] as const;

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

  /** The pink that runs through the whole theme. */
  accent: string;
  setAccent: (accent: string) => void;
}

/**
 * The derived shades.
 *
 * They are computed rather than picked: a person choosing a colour does not also want to
 * choose its hover, its glow and its 12% version. Handing them one colour and deriving the
 * rest means everything that reads `var(--color-accent)` follows along — the cursor bar, the
 * focus ring, the selected row, the panel title — with nothing else to change.
 */
const parse = (color: string): [number, number, number] | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const darken = ([r, g, b]: [number, number, number], amount: number): [number, number, number] =>
  [r, g, b].map((c) => c * (1 - amount)) as [number, number, number];

const rgba = ([r, g, b]: [number, number, number], alpha: number): string =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

const clamp = (c: number): number => Math.max(0, Math.min(255, Math.round(c)));
const toHex = (rgb: [number, number, number]): string => `#${rgb.map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`;

/**
 * The colour that is actually legible on this theme's background.
 *
 * The accent is used as a border and as a label colour. On a light background a pale
 * accent disappears, so it is darkened in steps until it reads; on a dark one a dark accent
 * disappears, so it is lightened. `dawn` is the light theme, and it does not follow the
 * `dark` class, which is why this is asked per theme rather than assumed.
 */
const legible = (rgb: [number, number, number], fondoClaro: boolean): string => {
  const [r, g, b] = rgb;
  for (let i = 0; i < 10; i++) {
    const factor = fondoClaro ? 1 - i * 0.08 : 1 + i * 0.12;
    const prueba: [number, number, number] = [r * factor, g * factor, b * factor];
    const luminancia = (0.299 * prueba[0] + 0.587 * prueba[1] + 0.114 * prueba[2]) / 255;
    if (fondoClaro ? luminancia < 0.55 : luminancia > 0.62) {
      return toHex(prueba);
    }
  }
  // Ten steps was not enough. Fall back to the extremes rather than to something unreadable.
  return toHex(fondoClaro ? [r * 0.2, g * 0.2, b * 0.2] : [r * 2, g * 2, b * 2]);
};

/** Themes whose background is light. `dawn` is the only one. */
const LIGHT_THEMES = new Set<Theme>(['dawn']);

/**
 * The four custom properties that follow from one colour.
 *
 * Returned as a plain object rather than written to the document here: the store has no
 * business touching the DOM, and the same function is what the tests check.
 */
export const accentVars = (accent: string, theme: Theme): Record<string, string> => {
  const rgb = parse(accent);
  if (!rgb) return {};
  return {
    '--color-accent': accent,
    '--color-accent-hover': toHex(darken(rgb, 0.12)),
    '--color-accent-glow': rgba(rgb, 0.4),
    '--color-accent-muted': rgba(rgb, 0.12),
    '--color-accent-legible': legible(rgb, LIGHT_THEMES.has(theme)),
  };
};

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

      accent: DEFAULT_ACCENT,
      setAccent: (accent) => {
        if (parse(accent)) set({ accent: accent.toLowerCase() });
      },
    }),
    { name: 'ui-store' }
  )
);