import { describe, expect, it } from 'vitest';
import { DEFAULT_NORMAL_KEYMAP, CHORD_WINDOW_MS } from '../defaults';
import { NORMAL_ACTIONS, RECURRENCE_ACTIONS } from '../actions';

describe('DEFAULT_NORMAL_KEYMAP', () => {
  it('tiene una tecla para cada accion salvo cycle_theme', () => {
    for (const action of NORMAL_ACTIONS) {
      if (action === 'cycle_theme') continue;
      expect(DEFAULT_NORMAL_KEYMAP[action]?.length, action).toBeGreaterThan(0);
    }
  });

  it('cycle_theme es la unica accion sin atajo, igual que en tuxedo', () => {
    const unbound = NORMAL_ACTIONS.filter((action) => !DEFAULT_NORMAL_KEYMAP[action]?.length);

    expect(unbound).toEqual(['cycle_theme']);
  });

  it('no define acciones que no esten en la lista', () => {
    for (const action of Object.keys(DEFAULT_NORMAL_KEYMAP)) {
      expect(NORMAL_ACTIONS, action).toContain(action);
    }
  });

  it('reproduce los chords de tuxedo', () => {
    expect(DEFAULT_NORMAL_KEYMAP.cursor_top).toEqual(['gg']);
    expect(DEFAULT_NORMAL_KEYMAP.delete).toEqual(['dd']);
    expect(DEFAULT_NORMAL_KEYMAP.copy_line).toEqual(['yy']);
    expect(DEFAULT_NORMAL_KEYMAP.pick_project).toEqual(['fp']);
  });

  it('respeta la excepcion de +, que el parser de tuxedo no puede escribir', () => {
    expect(DEFAULT_NORMAL_KEYMAP.begin_prompt_project).toEqual(['+']);
  });
});

describe('CHORD_WINDOW_MS', () => {
  it('es la ventana de 600 ms de tuxedo', () => {
    expect(CHORD_WINDOW_MS).toBe(600);
  });
});

describe('RECURRENCE_ACTIONS', () => {
  it('son las seis del constructor de recurrencia', () => {
    expect(RECURRENCE_ACTIONS).toHaveLength(6);
    expect(RECURRENCE_ACTIONS).toContain('accept');
    expect(RECURRENCE_ACTIONS).toContain('cancel');
  });
});