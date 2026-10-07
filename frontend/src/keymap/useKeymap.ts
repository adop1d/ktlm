import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionName, Keymap } from './actions';
import { CHORD_WINDOW_MS } from './defaults';

/** A bare modifier key: never a shortcut on its own. */
const MODIFIER_KEY: Readonly<Record<string, true>> = {
  Shift: true,
  Control: true,
  Alt: true,
  Meta: true,
  CapsLock: true,
};

/** `KeyboardEvent.key` speaks DOM; tuxedo speaks terminal key names. */
const NAMED_KEYS: Readonly<Record<string, string>> = {
  ArrowDown: 'Down',
  ArrowUp: 'Up',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Escape: 'Esc',
  ' ': 'space',
};

/** "j" | "Down" | "Ctrl-d" | "Shift-Tab" | "F1" | "Esc" | "space"; null if it should not count. */
export const normalizeKey = (event: KeyboardEvent): string | null => {
  if (MODIFIER_KEY[event.key]) return null;

  let key = NAMED_KEYS[event.key] ?? event.key;
  const isSingleChar = key.length === 1;
  // With Shift the DOM already delivers the letter uppercase, so there is no need to mark it
  // twice: `Shift-a` is `A` in tuxedo. Named keys do need the prefix.
  if (isSingleChar && event.shiftKey) key = key.toUpperCase();

  if (event.ctrlKey) key = `Ctrl-${key}`;
  else if (event.altKey) key = `Alt-${key}`;
  else if (event.shiftKey && !isSingleChar) key = `Shift-${key}`;

  return key;
};

/** Merges the user's shortcuts over tuxedo's; an empty entry does not override the default. */
export const mergeKeymaps = (defaults: Keymap, custom: Keymap): Keymap => {
  const merged: Record<string, readonly string[]> = { ...defaults };
  for (const [action, keys] of Object.entries(custom)) {
    if (keys.length > 0) {
      merged[action] = keys;
    }
  }
  return merged;
};

/** Finds the action; null if the key is unmapped or mapped to an empty list. */
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
 * Turns a key into the action it would fire, resolving chords.
 *
 * With a pending leader only the two-key binding is looked at: if it does not complete, the
 * key is consumed. Without a leader, a key that is both a prefix and its own action fires its
 * action and arms nothing — which is what keeps `d` (an action and the prefix of `dd`)
 * unambiguous.
 */
export const resolveAction = (
  keymap: Keymap,
  key: string,
  pendingChord: string | null
): { action: ActionName | null; nextChord: string | null } | null => {
  if (pendingChord !== null) {
    const action = lookupAction(keymap, pendingChord + key);
    // The leader is consumed even when it does not complete: in tuxedo the wrong key does
    // nothing.
    return action ? { action, nextChord: null } : null;
  }

  // The prefix wins over the action of its own. The case that settles it is `f`: it is bound
  // to `arm_f`, which is not an action but the leader of fp/fc/ff/fs. With the opposite
  // order, pressing `f` ran the leader instead of arming the chord, and `fs` never landed.
  if (isChordPrefix(keymap, key)) return { action: null, nextChord: key };

  const direct = lookupAction(keymap, key);
  return direct ? { action: direct, nextChord: null } : null;
};

export type KeymapMode = 'normal' | 'insert' | 'visual' | 'search' | 'palette';

export interface KeymapState {
  mode: KeymapMode;
  /** 'g' | 'd' | 'y' | 'f' while the chord window is open; otherwise null. */
  pendingChord: string | null;
}

export interface UseKeymapOptions {
  keymap: Keymap;
  onAction: (action: ActionName) => void;
  enabled?: boolean;
  onModeChange?: (mode: KeymapMode) => void;
  /**
   * Called when Esc is pressed. The engine keeps the key —that is what `escape_stack` does
   * in tuxedo— so the overlays close from here instead of mounting their own global listener:
   * two owners of the same key is a source of bugs.
   */
  onEscape?: () => void;
  /**
   * Actions that cannot run right now, with the reason. They are ignored instead of doing a
   * silent no-op: a shortcut that is off is better than one that pretends to work.
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
  // `normal` is the bottom of the stack; insert → search → palette stack on top, as in tuxedo.
  const [stack, setStack] = useState<readonly KeymapMode[]>(['normal']);
  const [pendingChord, setPendingChord] = useState<string | null>(null);
  // 0 as "no timer": clearTimeout(0) does nothing and avoids carrying a null through the type.
  const chordTimer = useRef(0);
  const mode = stack[stack.length - 1] ?? 'normal';
  // The listener is registered once and reads state through a ref: that way it is not
  // resubscribed on every render nor does it capture stale closures when the consumer passes
  // inline callbacks.
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
    // One timeout per chord, not an interval: the window can only expire once.
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
      // Meta is always ignored: hijacking Cmd+Q or Cmd+W would be worse than having no shortcut.
      if (event.metaKey) return;
      const key = normalizeKey(event);
      if (key === null) return;
      // In normal/visual the focus is usually in an input of the app itself: `j`/`k` belong
      // to the input.
      if (isTextEntryTarget(event.target) && (currentMode === 'normal' || currentMode === 'visual')) {
        return;
      }
      if (key === 'Esc') {
        // Esc never comes out as an action: the engine spends it on the mode stack and warns.
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
      // The engine already consumed the key: if it also reached the field the action just
      // opened, it would be typed into it. That used to happen with `n` —it opened the form
      // with an "n" in the title— and with `e` too.
      event.preventDefault();
      // An action that is off fires nothing and leaves no trace: the UI already says why.
      if (blocked?.actions.includes(resolved.action)) return;
      emit(resolved.action);
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      const pending = latest.current.pendingChord;
      // Releasing the leader does not close the window; otherwise `gg` would never complete.
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