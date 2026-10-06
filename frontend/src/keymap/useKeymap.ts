import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionName, Keymap } from './actions';
import { CHORD_WINDOW_MS } from './defaults';

/** Tecla modificadora suelta: nunca es un atajo por sí misma. */
const MODIFIER_KEY: Readonly<Record<string, true>> = {
  Shift: true,
  Control: true,
  Alt: true,
  Meta: true,
  CapsLock: true,
};

/** `KeyboardEvent.key` habla DOM; tuxedo habla nombres de terminal. */
const NAMED_KEYS: Readonly<Record<string, string>> = {
  ArrowDown: 'Down',
  ArrowUp: 'Up',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  ' ': 'space',
};

/** "j" | "Down" | "Ctrl-d" | "Shift-Tab" | "F1" | "Esc" | "space"; null si no debe contar. */
export const normalizeKey = (event: KeyboardEvent): string | null => {
  if (MODIFIER_KEY[event.key]) return null;

  let key = NAMED_KEYS[event.key] ?? event.key;
  const isSingleChar = key.length === 1;
  // Con Shift el DOM ya entrega la letra en mayúscula, así que no hay que marcarla dos
  // veces: `Shift-a` es `A` en tuxedo. En las teclas con nombre sí hace falta el prefijo.
  if (isSingleChar && event.shiftKey) key = key.toUpperCase();

  if (event.ctrlKey) key = `Ctrl-${key}`;
  else if (event.altKey) key = `Alt-${key}`;
  else if (event.shiftKey && !isSingleChar) key = `Shift-${key}`;

  return key;
};

/** Une atajos del usuario sobre los de tuxedo; una entrada vacía no pisa el default. */
export const mergeKeymaps = (defaults: Keymap, custom: Keymap): Keymap => {
  const merged: Record<string, readonly string[]> = { ...defaults };
  for (const [action, keys] of Object.entries(custom)) {
    if (keys.length > 0) {
      merged[action] = keys;
    }
  }
  return merged;
};

/** Busca la acción; null si la tecla no está mapeada o está mapeada a lista vacía. */
export const lookupAction = (keymap: Keymap, key: string): ActionName | null => {
  for (const [action, keys] of Object.entries(keymap)) {
    if (keys.includes(key)) return action as ActionName;
  }
  return null;
};

const isChordPrefix = (keymap: Keymap, key: string): boolean => {
  for (const keys of Object.values(keymap)) {
    if (keys.some((bound) => bound.length === 2 && bound.startsWith(key))) return true;
  }
  return false;
};

/**
 * Convierte una tecla en la acción que dispararía, resolviendo chords.
 *
 * Con un líder pendiente solo se mira la clave de dos teclas: si no completa, la tecla se
 * consume. Sin líder, una tecla que además de prefijo tiene acción propia dispara su acción y
 * no arma nada — que es lo que evita que `d` (acción y prefijo de `dd`) quede ambigua.
 */
export const resolveAction = (
  keymap: Keymap,
  key: string,
  pendingChord: string | null
): { action: ActionName | null; nextChord: string | null } | null => {
  if (pendingChord !== null) {
    const action = lookupAction(keymap, pendingChord + key);
    // El líder se consume aunque no complete: en tuxedo la tecla incorrecta no hace nada.
    return action ? { action, nextChord: null } : null;
  }

  // El prefijo manda sobre la acción propia. El caso que lo decide es `f`: está enlazado a
  // `arm_f`, que no es una acción sino el líder de fp/fc/ff/fs. Con el orden inverso, pulsar
  // `f` ejecutaba el líder en vez de armar el chord, y `fs` nunca llegaba.
  if (isChordPrefix(keymap, key)) return { action: null, nextChord: key };

  const direct = lookupAction(keymap, key);
  return direct ? { action: direct, nextChord: null } : null;
};

export type KeymapMode = 'normal' | 'insert' | 'visual' | 'search' | 'palette';

export interface KeymapState {
  mode: KeymapMode;
  /** 'g' | 'd' | 'y' | 'f' mientras la ventana del chord está abierta; si no, null. */
  pendingChord: string | null;
}

export interface UseKeymapOptions {
  keymap: Keymap;
  onAction: (action: ActionName) => void;
  enabled?: boolean;
  onModeChange?: (mode: KeymapMode) => void;
  /**
   * Se llama cuando se pulsa Esc. El motor se queda con la tecla —es lo que hace
   * `escape_stack` en tuxedo— así que los overlays se cierran desde aquí en vez de montar su
   * propio listener global: dos dueños de la misma tecla es una fuente de bugs.
   */
  onEscape?: () => void;
  /**
   * Acciones que ahora mismo no pueden ejecutarse, con el motivo. Se ignoran en vez de
   * hacer un no-op silencioso: es mejor un atajo apagado que uno que finge funcionar.
   */
  unavailable?: { actions: readonly ActionName[]; reason: string };
}

export interface UseKeymapResult {
  mode: KeymapMode;
  pendingChord: string | null;
  pushMode: (mode: Exclude<KeymapMode, 'normal'>) => void;
  popMode: () => void;
  setMode: (mode: KeymapMode) => void;
}

const isTextEntryTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  );
};

export const useKeymap = (options: UseKeymapOptions): UseKeymapResult => {
  const { keymap, onAction, enabled = true, onModeChange, onEscape, unavailable } = options;
  // `normal` es el fondo de la pila; insert → search → palette se apilan encima, como en tuxedo.
  const [stack, setStack] = useState<readonly KeymapMode[]>(['normal']);
  const [pendingChord, setPendingChord] = useState<string | null>(null);
  // 0 como "sin temporizador": clearTimeout(0) no hace nada y evita arrastrar un null por el tipo.
  const chordTimer = useRef(0);
  const mode = stack[stack.length - 1] ?? 'normal';
  // El listener se registra una sola vez y lee el estado por ref: así no se resuscribe en cada
  // render ni captura closures rancias cuando el consumidor pasa callbacks inline.
  const latest = useRef({ keymap, onAction, enabled, mode, pendingChord, unavailable });
  latest.current = { keymap, onAction, enabled, mode, pendingChord, unavailable };

  const clearChord = useCallback(() => {
    window.clearTimeout(chordTimer.current);
    chordTimer.current = 0;
    setPendingChord(null);
  }, []);

  const armChord = useCallback((leader: string) => {
    window.clearTimeout(chordTimer.current);
    setPendingChord(leader);
    // Un timeout por chord, no un interval: la ventana solo puede expirar una vez.
    chordTimer.current = window.setTimeout(() => {
      chordTimer.current = 0;
      setPendingChord(null);
    }, CHORD_WINDOW_MS);
  }, []);

  const pushMode = useCallback((next: Exclude<KeymapMode, 'normal'>) => {
    setStack((prev) => [...prev, next]);
  }, []);

  const popMode = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const setMode = useCallback((next: KeymapMode) => {
    setStack([next]);
  }, []);

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      const {
        keymap: map,
        onAction: emit,
        enabled: on,
        mode: currentMode,
        pendingChord: pending,
        unavailable: blocked,
      } = latest.current;
      if (!on) return;
      // Meta se ignora siempre: secuestrar Cmd+Q o Cmd+W sería peor que no tener atajo.
      if (event.metaKey) return;
      const key = normalizeKey(event);
      if (key === null) return;
      // En normal/visual el foco suele estar en un input de la propia app: `j`/`k` son del input.
      if (isTextEntryTarget(event.target) && (currentMode === 'normal' || currentMode === 'visual')) {
        return;
      }
      if (key === 'Esc') {
        // Esc nunca sale como acción: la gasta el motor contra la pila de modos y avisa.
        clearChord();
        popMode();
        onEscape?.();
        return;
      }
      const resolved = resolveAction(map, key, pending);
      clearChord();
      if (resolved === null) return;
      if (resolved.action === null) {
        if (resolved.nextChord !== null) armChord(resolved.nextChord);
        return;
      }
      // Una acción apagada no dispara nada ni deja rastro: la UI ya dice por qué.
      if (blocked?.actions.includes(resolved.action)) return;
      emit(resolved.action);
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      const pending = latest.current.pendingChord;
      // Soltar el líder no cierra la ventana; si no, `gg` nunca llegaría a completarse.
      if (pending === null || normalizeKey(event) === pending) return;
      clearChord();
    };

    const onBlur = (): void => {
      if (latest.current.pendingChord === null) return;
      clearChord();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.clearTimeout(chordTimer.current);
    };
  }, [enabled, clearChord, popMode, armChord, onEscape]);

  return { mode, pendingChord, pushMode, popMode, setMode };
};