import { FC } from 'react';
import { DocumentTextIcon, LinkIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTodoDoc } from './todoDoc';

/**
 * Estado del vínculo con el todo.txt: abrir, guardar como, y en qué punto está la sync.
 *
 * Presentacional a propósito: el hook con el sondeo vive en TaskListPage. Si esta barra
 * montara su propio `useTodoFile`, habría dos intervalos de sondeo y dos escritores
 * compitiendo por el mismo archivo.
 */
export const TodoFileBar: FC<{
  onOpen: () => void;
  onSaveAs: () => void;
  onDetach: () => void;
}> = ({ onOpen, onSaveAs, onDetach }) => {
  const { status, message, handle } = useTodoDoc();

  if (status === 'idle') {
    return (
      <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)]">
        <span className="text-xs text-[var(--text-muted)] dark:text-[var(--dark-text-muted)]">
          Sin todo.txt vinculado
        </span>
        <button onClick={onOpen} className="btn-secondary text-xs flex items-center gap-1.5">
          <DocumentTextIcon className="w-4 h-4" />
          Abrir todo.txt
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)]">
      <div className="flex items-center gap-2 min-w-0">
        <LinkIcon className="w-4 h-4 shrink-0 text-[var(--color-accent)]" />
        <span className="text-xs font-mono truncate text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)]">
          {handle?.name ?? 'todo.txt'}
        </span>
        <span
          className={`text-xs shrink-0 ${
            status === 'error'
              ? 'text-[var(--color-danger)]'
              : 'text-[var(--text-muted)] dark:text-[var(--dark-text-muted)]'
          }`}
        >
          {message ?? (handle?.persistent ? 'sincronizado' : 'en memoria')}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {handle?.persistent ? null : (
          <span className="text-xs text-[var(--color-warning)]">Sin File System Access API</span>
        )}
        <button onClick={onSaveAs} className="btn-ghost text-xs">
          Guardar como
        </button>
        <button onClick={onDetach} className="btn-ghost text-xs" aria-label="Desvincular archivo">
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};