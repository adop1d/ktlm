import type { Keymap } from './actions';

/**
 * Subconjunto de TOML suficiente para `~/.config/tuxedo/keybinds.toml`.
 *
 * Tuxedo hace hot-reload de su config y, si el parseo falla a medio escribir, deja la
 * anterior intacta. Aquí se replica: una línea mala se salta y el resto del archivo sigue
 * sirviendo, en vez de tirar el archivo entero por un typo.
 */
export interface ParsedKeybinds {
  normal?: Keymap;
  recurrence?: Keymap;
}

const KNOWN_SECTION: Record<string, true> = { normal: true, recurrence: true };

/** Las claves que el motor conoce. Una desconocida se ignora en vez de pasar al keymap. */
const KNOWN_NORMAL_ACTION: Record<string, true> = {
  cursor_down: true, cursor_up: true, cursor_top: true, cursor_bottom: true,
  half_page_down: true, half_page_up: true,
  begin_add: true, begin_edit: true, begin_edit_insert: true, toggle_complete: true,
  note_new: true, note_open: true,
  delete: true, reschedule: true, cycle_priority: true,
  move_task_down: true, move_task_up: true,
  begin_prompt_context: true, begin_prompt_project: true,
  copy_line: true, copy_body: true, undo: true,
  begin_search: true, arm_f: true, pick_project: true, pick_context: true,
  pick_saved_filter: true, save_current_filter: true,
  cycle_sort: true, toggle_visual: true, toggle_selected: true,
  go_list: true, toggle_archive_view: true, archive_completed: true,
  toggle_show_done: true, toggle_show_future: true,
  toggle_left_pane: true, toggle_right_pane: true, open_theme_picker: true,
  cycle_density: true, toggle_line_num: true, cycle_theme: true,
  open_command_palette: true, open_share: true, open_help: true, open_settings: true,
  escape_stack: true, quit: true,
};

const KNOWN_RECURRENCE_ACTION: Record<string, true> = {
  focus_next: true, focus_prev: true, value_next: true, value_prev: true,
  accept: true, cancel: true,
};

/**
 * Quita el comentario del final sin tocar un `#` que esté dentro de un valor entrecomillado.
 * Es el caso real: `open_help = "?"` convive con comentarios de sección.
 */
const stripComment = (line: string): string => {
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '#') return line.slice(0, i);
  }
  return line;
};

const unquote = (text: string): string => {
  const quoted =
    text.length >= 2 && (text.startsWith('"') || text.startsWith("'")) && text.endsWith(text[0]);
  return quoted ? text.slice(1, -1) : text;
};

/** `"a"` -> `['a']`; `["a", "b"]` -> `['a', 'b']`; cualquier otra cosa -> null. */
const parseValue = (raw: string): string[] | null => {
  const text = raw.trim();
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(',')
      .map((part) => unquote(part.trim()))
      .filter((value) => value.length > 0);
  }
  const single = unquote(text);
  return single ? [single] : null;
};

export const parseKeybindsToml = (source: string): ParsedKeybinds => {
  // Acumulador mutable: Keymap es de solo lectura y aquí se está construyendo.
  const out: {
    normal?: Record<string, readonly string[]>;
    recurrence?: Record<string, readonly string[]>;
  } = {};
  let section: 'normal' | 'recurrence' | null = null;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = stripComment(rawLine).trim();
    if (!line) continue;

    const header = line.match(/^\[([A-Za-z0-9_-]+)\]$/);
    if (header) {
      const name = header[1];
      section = KNOWN_SECTION[name] ? (name as 'normal' | 'recurrence') : null;
      if (section) out[section] ??= {};
      continue;
    }

    if (!section) continue;

    const pair = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (!pair) continue;

    const key = pair[1];
    if (!(section === 'normal' ? KNOWN_NORMAL_ACTION : KNOWN_RECURRENCE_ACTION)[key]) continue;

    // El valor se toma literal, sin trocear por "+": `begin_prompt_project = "+"` debe dar
    // ['+'] y no una lista vacía. Tuxedo no puede escribir esa línea, pero nosotros sí
    // debemos saber leerla.
    const value = parseValue(pair[2]);
    if (value === null) continue;

    out[section]![key] = value;
  }

  return out;
};