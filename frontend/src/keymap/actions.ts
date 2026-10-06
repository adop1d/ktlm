export type ActionName =
  | 'cursor_down' | 'cursor_up' | 'cursor_top' | 'cursor_bottom'
  | 'half_page_down' | 'half_page_up'
  | 'begin_add' | 'begin_edit' | 'begin_edit_insert' | 'toggle_complete'
  | 'delete' | 'reschedule' | 'cycle_priority' | 'move_task_down' | 'move_task_up'
  | 'begin_prompt_context' | 'begin_prompt_project'
  | 'copy_line' | 'copy_body' | 'undo'
  | 'begin_search' | 'arm_f' | 'pick_project' | 'pick_context'
  | 'pick_saved_filter' | 'save_current_filter'
  | 'cycle_sort' | 'toggle_visual' | 'toggle_selected'
  | 'go_list' | 'toggle_archive_view' | 'archive_completed'
  | 'toggle_show_done' | 'toggle_show_future'
  | 'toggle_left_pane' | 'toggle_right_pane' | 'open_theme_picker'
  | 'cycle_density' | 'toggle_line_num' | 'cycle_theme'
  | 'open_command_palette' | 'open_share' | 'open_help' | 'open_settings'
  | 'escape_stack' | 'quit';

export type RecurrenceAction =
  | 'focus_next' | 'focus_prev' | 'value_next' | 'value_prev' | 'accept' | 'cancel';

export type Keymap = Readonly<Record<string, readonly string[]>>;

/** Order drives the `?` overlay and the command palette, so it follows tuxedo's grouping. */
export const NORMAL_ACTIONS: readonly ActionName[] = [
  'cursor_down',
  'cursor_up',
  'cursor_top',
  'cursor_bottom',
  'half_page_down',
  'half_page_up',
  'begin_add',
  'begin_edit',
  'begin_edit_insert',
  'toggle_complete',
  'delete',
  'reschedule',
  'cycle_priority',
  'move_task_down',
  'move_task_up',
  'begin_prompt_context',
  'begin_prompt_project',
  'copy_line',
  'copy_body',
  'undo',
  'begin_search',
  'arm_f',
  'pick_project',
  'pick_context',
  'pick_saved_filter',
  'save_current_filter',
  'cycle_sort',
  'toggle_visual',
  'toggle_selected',
  'go_list',
  'toggle_archive_view',
  'archive_completed',
  'toggle_show_done',
  'toggle_show_future',
  'toggle_left_pane',
  'toggle_right_pane',
  'open_theme_picker',
  'cycle_density',
  'toggle_line_num',
  'cycle_theme',
  'open_command_palette',
  'open_share',
  'open_help',
  'open_settings',
  'escape_stack',
  'quit',
];

export const RECURRENCE_ACTIONS: readonly RecurrenceAction[] = [
  'focus_next',
  'focus_prev',
  'value_next',
  'value_prev',
  'accept',
  'cancel',
];