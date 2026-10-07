import { FC } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ActionName } from './actions';
import { Portal } from '../components/common/Portal';

/**
 * El overlay `?` de tuxedo, generado desde la misma tabla de atajos que ejecuta el motor.
 * Una sola fuente de verdad: si un atajo cambia en defaults.ts, cambia aquí sin tocar nada.
 */

const GROUPS: { title: string; actions: readonly ActionName[] }[] = [
  {
    title: 'Navegación',
    actions: [
      'cursor_down',
      'cursor_up',
      'cursor_top',
      'cursor_bottom',
      'half_page_down',
      'half_page_up',
    ],
  },
  {
    title: 'Edición',
    actions: [
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
    ],
  },
  {
    title: 'Filtrar, ordenar y vistas',
    actions: [
      'begin_search',
      'arm_f',
      'pick_project',
      'pick_context',
      'pick_saved_filter',
      'save_current_filter',
      'cycle_sort',
      'toggle_visual',
      'go_list',
      'toggle_archive_view',
      'archive_completed',
      'note_new',
      'note_open',
      'toggle_show_done',
      'toggle_show_future',
    ],
  },
  {
    title: 'Sistema',
    actions: ['open_command_palette', 'open_help', 'open_settings', 'open_share', 'escape_stack', 'quit'],
  },
];

/** Etiquetas legibles. Los nombres snake_case no significan nada en la pantalla. */
const LABELS: Partial<Record<ActionName, string>> = {
  cursor_down: 'siguiente tarea',
  cursor_up: 'tarea anterior',
  cursor_top: 'primera tarea',
  cursor_bottom: 'última tarea',
  half_page_down: 'media página abajo',
  half_page_up: 'media página arriba',
  begin_add: 'nueva tarea',
  begin_edit: 'editar (modo normal)',
  begin_edit_insert: 'editar (modo insert)',
  toggle_complete: 'completar',
  note_new: 'nota nueva',
  note_open: 'abrir nota',
  delete: 'borrar',
  reschedule: 'cambiar fecha',
  cycle_priority: 'cambiar prioridad',
  move_task_down: 'mover abajo',
  move_task_up: 'mover arriba',
  begin_prompt_context: 'añadir contexto',
  begin_prompt_project: 'añadir proyecto',
  copy_line: 'copiar línea',
  copy_body: 'copiar texto',
  undo: 'deshacer',
  begin_search: 'buscar',
  arm_f: 'prefijo de filtros',
  pick_project: 'filtrar por proyecto',
  pick_context: 'filtrar por contexto',
  pick_saved_filter: 'búsqueda guardada',
  save_current_filter: 'guardar búsqueda',
  cycle_sort: 'cambiar orden',
  toggle_visual: 'modo visual',
  toggle_selected: 'seleccionar',
  go_list: 'vista de lista',
  toggle_archive_view: 'ver archivo',
  archive_completed: 'archivar completadas',
  toggle_show_done: 'mostrar completadas',
  toggle_show_future: 'mostrar futuras',
  open_command_palette: 'paleta de comandos',
  open_help: 'esta ayuda',
  open_settings: 'ajustes',
  open_share: 'captura por móvil',
  escape_stack: 'salir del modo',
  quit: 'salir',
};

export const HelpOverlay: FC<{
  keymap: Record<string, readonly string[]>;
  onClose: () => void;
  /** Acciones apagadas ahora mismo, con el motivo. Se listan, pero tachadas. */
  unavailable?: { actions: readonly ActionName[]; reason: string };
}> = ({ keymap, onClose, unavailable }) => {
  // Esc lo cierra el motor de teclado, que es su dueño: ver onEscape en useKeymap.

  return (
    <Portal>
    <div className="tui-overlay" onClick={onClose} role="dialog" aria-label="Atajos de teclado">
      <div
        className="tui-modal"
        style={{ maxWidth: '48rem' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="tui-modal-header">
          <h2>Atajos de teclado</h2>
          <button onClick={onClose} aria-label="Cerrar ayuda" className="btn-ghost text-xs">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="tui-modal-body">
          {GROUPS.map((group) => {
            const bound = group.actions.filter((action) => (keymap[action] ?? []).length > 0);
            if (bound.length === 0) return null;
            const isOff = (action: ActionName) => unavailable?.actions.includes(action) === true;
            return (
              <section key={group.title} className="mb-4">
                <h3 className="text-xs uppercase tracking-wide text-[var(--text-muted)] mb-2">
                  {group.title}
                </h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                  {bound.map((action) => (
                    <li
                      key={action}
                      className={`flex items-baseline gap-2 text-sm ${
                        isOff(action) ? 'opacity-40' : ''
                      }`}
                    >
                      <span className="flex gap-1 shrink-0">
                        {keymap[action].map((key) => (
                          <kbd
                            key={key}
                            className="px-1.5 py-0.5 bg-[var(--color-accent)] text-white rounded-sm font-mono font-bold text-[10px]"
                          >
                            {key}
                          </kbd>
                        ))}
                      </span>
                      <span className="text-[var(--text-secondary)]">
                        {LABELS[action] ?? action}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}

          {unavailable && (
            <p className="text-xs text-[var(--color-warning)] mb-3">
              Apagados: {unavailable.reason}.
            </p>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            Atajos copiados de tuxedo. Pulsa <kbd>Esc</kbd> para cerrar.
          </p>
        </div>
      </div>
    </div>
  </Portal>
  );
};
