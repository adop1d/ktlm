/** Mirrors tuxedo 2026.8.1 `~/.config/tuxedo/keybinds.toml`. */
export const DEFAULT_NORMAL_KEYMAP: Record<string, readonly string[]> = {
  cursor_down: ['j', 'Down'],
  cursor_up: ['k', 'Up'],
  cursor_top: ['gg'],
  cursor_bottom: ['G'],
  half_page_down: ['Ctrl-d'],
  half_page_up: ['Ctrl-u'],
  begin_add: ['n'],
  begin_edit: ['e'],
  begin_edit_insert: ['i'],
  // The box version of `e`. `e` edits the line itself; this one opens the form, for when
  // clicking is the faster way.
  begin_edit_form: ['E'],
  toggle_complete: ['x'],
  note_new: ['o'],
  note_open: ['O'],
  delete: ['dd'],
  reschedule: ['r'],
  cycle_priority: ['p'],
  move_task_down: ['J'],
  move_task_up: ['K'],
  begin_prompt_context: ['c'],
  // tuxedo's own parser splits on `+`, so `begin_prompt_project = "+"` is unwritable in TOML
  // and anyone rewriting the file must pick a different key. The default itself stays `+`.
  begin_prompt_project: ['+'],
  copy_line: ['yy'],
  copy_body: ['yb'],
  undo: ['u'],
  begin_search: ['/'],
  arm_f: ['f'],
  pick_project: ['fp'],
  pick_context: ['fc'],
  pick_saved_filter: ['ff'],
  save_current_filter: ['fs'],
  cycle_sort: ['S'],
  toggle_visual: ['v'],
  toggle_selected: ['space'],
  go_list: ['l'],
  toggle_archive_view: ['a'],
  archive_completed: ['A'],
  toggle_show_done: ['H'],
  toggle_show_future: ['F'],
  toggle_left_pane: ['['],
  toggle_right_pane: [']'],
  open_theme_picker: ['T'],
  cycle_density: ['D'],
  toggle_line_num: ['L'],
  // No default on purpose, same as tuxedo: the theme cycle is reachable from the picker (`T`),
  // and a second always-on chord would fight user config.
  cycle_theme: [],
  open_command_palette: [':', 'Ctrl-P'],
  open_share: ['s'],
  open_help: ['?'],
  open_settings: [','],
  escape_stack: ['Esc'],
  quit: ['q'],
};

export const DEFAULT_RECURRENCE_KEYMAP: Record<string, readonly string[]> = {
  focus_next: ['j', 'Down', 'Tab'],
  focus_prev: ['k', 'Up', 'Shift-Tab'],
  value_next: ['l', 'Right', '+', '='],
  value_prev: ['h', 'Left', '-', '_'],
  accept: ['Enter'],
  cancel: ['Esc'],
};

/** Tuxedo's two-key chord window; long enough to type `gg`, short enough to not feel laggy. */
export const CHORD_WINDOW_MS = 600;