import { FC } from 'react';
import { DocumentTextIcon, LinkIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTodoDoc } from './todoDoc';

/**
 * The link to the file. The server holds the file, so there are only three things here:
 * connect it, bring in a list you have on disk, and disconnect it.
 */
export const TodoFileBar: FC<{
  onOpen: () => void;
  onImport: () => void;
  onDetach: () => void;
  canImport: boolean;
}> = ({ onOpen, onImport, onDetach, canImport }) => {
  const { status, message } = useTodoDoc();

  if (status === 'idle') {
    return (
      <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)]">
        <span className="text-xs text-[var(--text-muted)] dark:text-[var(--dark-text-muted)]">
          Sin todo.txt vinculado
        </span>
        <div className="flex items-center gap-2">
          {canImport ? (
            <button onClick={onImport} className="btn-ghost text-xs flex items-center gap-1.5">
              <DocumentTextIcon className="w-4 h-4" />
              Importar del disco
            </button>
          ) : null}
          <button onClick={onOpen} className="btn-secondary text-xs">
            Conectar todo.txt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)]">
      <div className="flex items-center gap-2 min-w-0">
        <LinkIcon className="w-4 h-4 shrink-0 text-[var(--color-accent)]" />
        <span className="text-xs font-mono truncate text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)]">
          todo.txt
        </span>
        <span
          className={`text-xs shrink-0 ${
            status === 'error'
              ? 'text-[var(--color-danger)]'
              : 'text-[var(--text-muted)] dark:text-[var(--dark-text-muted)]'
          }`}
        >
          {message ?? (status === 'syncing' ? 'guardando…' : 'sincronizado')}
        </span>
      </div>
      <button onClick={onDetach} className="btn-ghost text-xs" aria-label="Desvincular archivo">
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  );
};