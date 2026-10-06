import { FC, memo } from 'react';
import { CheckIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Task } from '../../types/task';

/**
 * Una fila de la lista. En una terminal cada línea es una fila de celdas con columnas
 * alineadas: aquí el índice, la prioridad y el cuerpo ocupan posiciones fijas, y el
 * puntero de cursor y la marca de completada se leen sin pasar por el color.
 *
 * Los botones se descubren al pasar el ratón igual que en la tarjeta de la que viene:
 * quitarlos sería quitar una vía de uso, no simplificar.
 */

const PRIORITY_LETTER = { HIGH: 'A', MEDIUM: 'B', LOW: 'C' } as const;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const shortDate = (iso: string | undefined): string => {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return '';
  return `${day} ${MONTHS[Number(month) - 1]}`;
};

const TaskRowBase: FC<{
  index: number;
  task: Task;
  isCursor: boolean;
  isSelected: boolean;
  onFocus: (index: number) => void;
  onToggle: (id: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
}> = ({ index, task, isCursor, isSelected, onFocus, onToggle, onEdit, onDelete }) => (
  <div
    className={[
      'tui-row group',
      isCursor ? 'tui-row--cursor' : '',
      isSelected ? 'tui-row--selected' : '',
      task.completed ? 'tui-row--done' : '',
    ]
      .filter(Boolean)
      .join(' ')}
    aria-current={isCursor ? 'true' : undefined}
    onClick={() => onFocus(index)}
  >
    <span className="tui-row-index">{String(index + 1).padStart(3, ' ')}</span>

    <span className={`tui-row-prio tui-row-prio--${PRIORITY_LETTER[task.priority]}`}>
      {PRIORITY_LETTER[task.priority]}
    </span>

    <span className="tui-row-title">
      {task.title}
      {task.projects?.length || task.contexts?.length ? (
        <span className="tui-row-tags">
          {' '}
          {[...(task.projects ?? []), ...(task.contexts ?? [])].join(' ')}
        </span>
      ) : null}
    </span>

    <span className="tui-row-meta">
      {task.dueDate ? <span>due {shortDate(task.dueDate)}</span> : null}
      {task.recurrence ? <span> rec {task.recurrence}</span> : null}
      {task.completed && task.completedAt ? <span> done {shortDate(task.completedAt)}</span> : null}

      <span className="tui-row-actions">
        <button
          title={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
          aria-label={task.completed ? 'Marcar como pendiente' : 'Marcar como completada'}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(task.id);
          }}
        >
          <CheckIcon className="w-3.5 h-3.5" />
        </button>
        <button
          title="Editar"
          aria-label="Editar"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(task);
          }}
        >
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        <button
          title="Eliminar"
          aria-label="Eliminar"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(task.id);
          }}
        >
          <TrashIcon className="w-3.5 h-3.5" />
        </button>
      </span>
    </span>
  </div>
);

/** La lista llega a veinte filas y se repinta en cada pulsación: memo amortigua el trabajo. */
export const TaskRow = memo(TaskRowBase);