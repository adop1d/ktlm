import { describe, expect, it } from 'vitest';
import { DEFAULT_NORMAL_KEYMAP } from '../defaults';
import {
  lookupAction,
  mergeKeymaps,
  normalizeKey,
  resolveAction,
} from '../useKeymap';
import type { ActionName } from '../actions';

const keyEvent = (init: Partial<KeyboardEvent> & { key: string }): KeyboardEvent =>
  ({ metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...init }) as KeyboardEvent;

describe('normalizeKey', () => {
  it('traduce el DOM a los nombres que usa tuxedo', () => {
    expect(normalizeKey(keyEvent({ key: 'j' }))).toBe('j');
    expect(normalizeKey(keyEvent({ key: 'ArrowDown' }))).toBe('Down');
    expect(normalizeKey(keyEvent({ key: 'Escape' }))).toBe('Esc');
    expect(normalizeKey(keyEvent({ key: ' ' }))).toBe('space');
    expect(normalizeKey(keyEvent({ key: 'F1' }))).toBe('F1');
  });

  it('antepone el modificador de control', () => {
    expect(normalizeKey(keyEvent({ key: 'd', ctrlKey: true }))).toBe('Ctrl-d');
    expect(normalizeKey(keyEvent({ key: 'Tab', shiftKey: true }))).toBe('Shift-Tab');
    expect(normalizeKey(keyEvent({ key: 'x', altKey: true }))).toBe('Alt-x');
  });

  it('devuelve null para un modificador suelto', () => {
    expect(normalizeKey(keyEvent({ key: 'Shift' }))).toBeNull();
    expect(normalizeKey(keyEvent({ key: 'Meta' }))).toBeNull();
  });
});

describe('mergeKeymaps', () => {
  it('una entrada vacía no pisa el default', () => {
    const merged = mergeKeymaps(DEFAULT_NORMAL_KEYMAP, { cycle_theme: [], begin_add: ['N'] });

    expect(merged.cycle_theme).toEqual([]);
    expect(merged.begin_add).toEqual(['N']);
    expect(merged.cursor_down).toEqual(['j', 'Down']);
  });
});

describe('lookupAction', () => {
  it('devuelve null para una lista vacía', () => {
    expect(lookupAction({ cycle_theme: [] }, 't')).toBeNull();
  });

  it('encuentra la acción de una tecla', () => {
    expect(lookupAction(DEFAULT_NORMAL_KEYMAP, 'x')).toBe('toggle_complete');
    expect(lookupAction(DEFAULT_NORMAL_KEYMAP, 'gg')).toBe('cursor_top');
  });
});

describe('resolveAction', () => {
  it('una tecla simple dispara su acción', () => {
    expect(resolveAction(DEFAULT_NORMAL_KEYMAP, 'x', null)).toEqual({
      action: 'toggle_complete',
      nextChord: null,
    });
  });

  it('arma el chord con un prefijo que no tiene acción propia', () => {
    expect(resolveAction(DEFAULT_NORMAL_KEYMAP, 'g', null)).toEqual({
      action: null,
      nextChord: 'g',
    });
  });

  it('completa el chord pendiente con la segunda tecla', () => {
    expect(resolveAction(DEFAULT_NORMAL_KEYMAP, 'g', 'g')).toEqual({
      action: 'cursor_top',
      nextChord: null,
    });
  });

  it('el prefijo de un chord manda sobre la acción enlazada a esa tecla', () => {
    // `f` is bound to arm_f, which is not an action but the leader. If the action of its own
    // won, `fs` and `ff` would never fire.
    expect(resolveAction(DEFAULT_NORMAL_KEYMAP, 'f', null)).toEqual({
      action: null,
      nextChord: 'f',
    });
  });

  it('una tecla que es su propia acción y no prefijo de nada, dispara', () => {
    // `p` is cycle_priority and does not open any chord by itself.
    expect(resolveAction(DEFAULT_NORMAL_KEYMAP, 'p', null)).toEqual({
      action: 'cycle_priority',
      nextChord: null,
    });
  });

  it('el líder consume la tecla aunque no complete el chord', () => {
    expect(resolveAction(DEFAULT_NORMAL_KEYMAP, 'x', 'g')).toBeNull();
  });

  it('una tecla no mapeada ni prefijo no hace nada', () => {
    expect(resolveAction(DEFAULT_NORMAL_KEYMAP, 'Q', null)).toBeNull();
  });
});

describe('resolveAction con el keymap por defecto de tuxedo', () => {
  it('cubre el ciclo completo de la tabla de tuxedo', () => {
    const expected: [string, ActionName][] = [
      ['j', 'cursor_down'],
      ['k', 'cursor_up'],
      ['G', 'cursor_bottom'],
      ['Ctrl-d', 'half_page_down'],
      ['n', 'begin_add'],
      ['x', 'toggle_complete'],
      ['p', 'cycle_priority'],
      ['J', 'move_task_down'],
      ['K', 'move_task_up'],
      ['u', 'undo'],
      ['/', 'begin_search'],
      ['S', 'cycle_sort'],
      ['v', 'toggle_visual'],
      ['space', 'toggle_selected'],
      ['A', 'archive_completed'],
      [':', 'open_command_palette'],
      ['?', 'open_help'],
    ];

    for (const [key, action] of expected) {
      expect(resolveAction(DEFAULT_NORMAL_KEYMAP, key, null), `tecla ${key}`).toEqual({
        action,
        nextChord: null,
      });
    }
  });
});

describe('resolveAction con teclas sin atajo', () => {
  it('devuelve null sin armar chord', () => {
    // `q` is bound to `quit` in tuxedo: it is not a free key.
    for (const key of ['Z', 'F12', 'Shift-q', 'Ctrl-z', 'Alt-j']) {
      expect(resolveAction(DEFAULT_NORMAL_KEYMAP, key, null), key).toBeNull();
    }
  });
});
