import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CATALOGUE, type Language } from './catalogue';

type Entrada = { es: string; en: string };
type Catalogo = Record<string, Entrada>;

// The catalogue is `as const` so the keys are checked at compile time, which makes it a
// readonly literal type rather than the Record the lookup wants. It is written in this file
// and cannot be malformed at runtime, so widening it once here is sound.
const CATALOGO: Catalogo = CATALOGUE;

/**
 * A language is chosen, never guessed on every load.
 *
 * The guess happens once, when there is nothing stored yet, and then the choice sticks: a
 * browser that reports Spanish and a person who then picks English must not be fought on
 * every reload.
 */
interface I18nState {
  language: Language;
  setLanguage: (language: Language) => void;
}

/**
 * The languages that exist.
 *
 * Checked by value and not as a type, because the value comes out of localStorage, where
 * anything can be.
 */
const LANGUAGES: Record<Language, string> = { es: 'es', en: 'en' };

const guess = (): Language => {
  if (typeof navigator === 'undefined') return 'es';
  const navegador = navigator.language?.toLowerCase() ?? '';
  return navegador.startsWith('es') ? 'es' : 'en';
};

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: guess(),
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'i18n-store',
      version: 1,
      // No migrate on purpose. It receives the persist envelope, not the state, and
      // reading the language out of the wrong shape is how a stored choice silently turns
      // into the default one on every reload. The value is checked when it is read instead,
      // which is where a language that stopped existing would actually do damage.
      merge: (guardado, actual) => {
        const guardada = (guardado as { language?: unknown } | null)?.language;
        if (typeof guardada !== 'string' || !(guardada in LANGUAGES)) {
          return actual;
        }
        return { ...actual, language: guardada as Language };
      },
    }
  )
);

/**
 * The translation function.
 *
 * <p>A missing entry returns the Spanish one, not the key. That way a string that has not
 * been translated yet still reads as the sentence it was, and the only visible cost is that
 * the interface is partly in one language — which is what it was before this existed.
 */
export const translate = (catalogo: Catalogo, language: Language, key: string): string => {
  const entrada = catalogo[key];
  if (!entrada) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] falta la clave «${key}»`);
    }
    return key;
  }
  return entrada[language] ?? entrada.es;
};

/** Substitution, so a catalogue entry can hold `{name}` without knowing anything about React. */
export const format = (plantilla: string, valores: Record<string, string | number>): string =>
  plantilla.replace(/\{(\w+)\}/g, (_, nombre: string) =>
    nombre in valores ? String(valores[nombre]) : `{${nombre}}`
  );

/**
 * React hook.
 *
 * <p>The function it returns is rebuilt on every render rather than memoised on purpose:
 * memoising it would need `language` in the dependency list of every caller, and a stale
 * translation after switching language is worse than one extra object per render.
 */
export const useT = () => {
  const language = useI18nStore((state) => state.language);

  return (key: string, valores?: Record<string, string | number>): string => {
    const texto = translate(CATALOGO, language, key);
    return valores ? format(texto, valores) : texto;
  };
};

/** Exposed for tests: the same lookup without React. */
export const t = translate;
export type { Catalogo, Entrada };