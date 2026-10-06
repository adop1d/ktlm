import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { ActionName, NORMAL_ACTIONS } from './actions';
import { Portal } from '../components/common/Portal';

/**
 * La paleta de tuxedo: `:` o Ctrl-P. Se busca por etiqueta y Enter ejecuta.
 *
 * El orden reproduce el de tuxedo —inicio de etiqueta, luego frontera de palabra, luego
 * dentro— porque en una lista de cuarenta y pico comandos la posición es el ranking.
 */

export interface Command {
  action: ActionName;
  label: string;
  keys: readonly string[];
  available: boolean;
}

const LABELS: Record<ActionName, string> = {
  cursor_down: 'siguiente tarea',
  cursor_up: 'tarea anterior',
  cursor_top: 'primera tarea',
  cursor_bottom: 'última tarea',
  half_page_down: 'media página abajo',
  half_page_up: 'media página arriba',
  begin_add: 'nueva tarea',
  begin_edit: 'editar en modo normal',
  begin_edit_insert: 'editar en modo insert',
  toggle_complete: 'completar',
  delete: 'borrar',
  reschedule: 'cambiar recurrencia',
  cycle_priority: 'cambiar prioridad',
  move_task_down: 'mover abajo',
  move_task_up: 'mover arriba',
  begin_prompt_context: 'añadir contexto',
  begin_prompt_project: 'añadir proyecto',
  copy_line: 'copiar línea',
  copy_body: 'copiar el texto',
  undo: 'deshacer',
  begin_search: 'buscar',
  arm_f: 'prefijo de filtros',
  pick_project: 'filtrar por proyecto',
  pick_context: 'filtrar por contexto',
  pick_saved_filter: 'búsqueda guardada',
  save_current_filter: 'guardar búsqueda',
  cycle_sort: 'cambiar el orden',
  toggle_visual: 'modo visual',
  toggle_selected: 'seleccionar',
  go_list: 'vista de lista',
  toggle_archive_view: 'ver el archivo',
  archive_completed: 'archivar completadas',
  toggle_show_done: 'mostrar completadas',
  toggle_show_future: 'mostrar futuras',
  toggle_left_pane: 'panel izquierdo',
  toggle_right_pane: 'panel derecho',
  open_theme_picker: 'temas',
  cycle_density: 'densidad',
  toggle_line_num: 'números de línea',
  cycle_theme: 'tema',
  open_command_palette: 'paleta de comandos',
  open_share: 'captura por móvil',
  open_help: 'atajos',
  open_settings: 'ajustes',
  escape_stack: 'salir del modo',
  quit: 'salir',
};

/** Puntuación de un comando para una consulta. 0 = no coincide. */
const score = (label: string, query: string): number => {
  if (!query) return 1;
  const haystack = label.toLowerCase();
  const needle = query.toLowerCase();

  // Tuxedo ordena por dónde cae la coincidencia, no por cuántas hay.
  const at = haystack.indexOf(needle);
  if (at === 0) return 1000;
  if (at > 0 && haystack[at - 1] === ' ') return 500;
  if (at > 0) return 100;
  return 50;
};

export const rankCommands = (
  commands: readonly Command[],
  query: string
): Command[] =>
  commands
    .map((command) => ({ command, weight: score(command.label, query) }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => entry.command);

export const CommandPalette: FC<{
  keymap: Record<string, readonly string[]>;
  unavailable?: { actions: readonly ActionName[]; reason: string };
  onRun: (action: ActionName) => void;
  onClose: () => void;
}> = ({ keymap, unavailable, onRun, onClose }) => {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo(
    () =>
      NORMAL_ACTIONS.filter((action) => (keymap[action] ?? []).length > 0).map((action) => ({
        action,
        label: LABELS[action],
        keys: keymap[action],
        available: unavailable?.actions.includes(action) !== true,
      })),
    [keymap, unavailable]
  );

  const ranked = useMemo(() => rankCommands(commands, query), [commands, query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  return (
    <Portal>
    <div
      className="tui-overlay items-start"
      style={{ paddingTop: '6rem' }}
      role="dialog"
      aria-label="Paleta de comandos"
    >
      <div className="tui-modal w-full" style={{ maxWidth: '34rem' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((current) => Math.min(current + 1, ranked.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((current) => Math.max(current - 1, 0));
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const chosen = ranked[active];
              // Una acción apagada no se ejecuta: se ignora y el motivo ya está en la fila.
              if (chosen?.available) onRun(chosen.action);
            } else if (event.key === 'Escape') {
              onClose();
            }
          }}
          aria-label="Buscar comando"
          placeholder="Buscar comando..."
          className="input-field w-full font-mono"
        />

        <ul className="mt-3 max-h-80 overflow-y-auto">
          {ranked.map((command, index) => (
            <li key={command.action}>
              <button
                onMouseEnter={() => setActive(index)}
                onClick={() => command.available && onRun(command.action)}
                disabled={!command.available}
                className={`w-full flex items-center justify-between gap-3 px-2 py-1.5 text-left text-sm rounded-[var(--radius-sm)] ${
                  index === active ? 'bg-[var(--surface-elevated)]' : ''
                } ${command.available ? '' : 'opacity-40 cursor-not-allowed'}`}
              >
                <span className="text-[var(--text-primary)] dark:text-[var(--dark-text-primary)]">
                  {command.label}
                </span>
                <span className="flex gap-1 shrink-0">
                  {command.keys.map((key) => (
                    <kbd
                      key={key}
                      className="px-1.5 py-0.5 bg-[var(--color-accent)] text-white rounded font-mono font-bold text-[10px]"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </button>
            </li>
          ))}
          {ranked.length === 0 && (
            <li className="px-2 py-3 text-sm text-[var(--text-muted)] dark:text-[var(--dark-text-muted)]">
              Nada coincide con «{query}»
            </li>
          )}
        </ul>

        {unavailable && (
          <p className="text-xs text-[var(--color-warning)] mt-2">
            Las acciones apagadas necesitan un motivo: {unavailable.reason}.
          </p>
        )}
      </div>
    </div>
  </Portal>
  );
};
