import { FC, useState, FormEvent } from 'react';
import { Task, TaskPriority } from '../../types/task';
import {
  XMarkIcon,
  CalendarIcon,
  FlagIcon,
  FolderIcon,
  TagIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

type Props = {
  initial?: Partial<Task>;
  onSubmit: (data: Partial<Task>) => void;
  onCancel: () => void;
};

const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'HIGH', label: 'Alta', color: 'text-[var(--color-danger)]' },
  { value: 'MEDIUM', label: 'Media', color: 'text-[var(--color-warning)]' },
  { value: 'LOW', label: 'Baja', color: 'text-[var(--color-success)]' },
];

export const TaskForm: FC<Props> = ({ initial = {}, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initial.title ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [priority, setPriority] = useState<TaskPriority>(initial.priority ?? 'MEDIUM');
  const [dueDate, setDueDate] = useState(initial.dueDate?.split('T')[0] ?? '');
  // Projects and contexts are tags in the file, so they are stored the same way: a list,
  // joined by a space. They were missing here even though the keyboard could already set
  // them with `c` and `+`, which meant the two ways of doing the same thing disagreed.
  const [projects, setProjects] = useState(initial.projects?.join(' ') ?? '');
  const [contexts, setContexts] = useState(initial.contexts?.join(' ') ?? '');
  const [recurrence, setRecurrence] = useState(initial.recurrence ?? '');
  const [startDate, setStartDate] = useState((initial as { startDate?: string }).startDate?.split('T')[0] ?? '');

  const splitTags = (raw: string): string[] =>
    raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const taskData: Partial<Task> = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      startDate: startDate || undefined,
      recurrence: recurrence.trim() || undefined,
      projects: splitTags(projects),
      contexts: splitTags(contexts),
    };
    onSubmit(taskData);
  };

  const isEditing = !!initial.title;

  return (
    <div className="card-form animate-fade-in border-l-4 border-l-[var(--color-accent)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)] dark:text-[var(--dark-text-primary)]">
          {isEditing ? 'Editar tarea' : 'Nueva tarea'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="task-title" 
            className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5"
          >
            Título
          </label>
          <input
            id="task-title"
            type="text"
            className="input-field"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="¿Qué necesitas hacer?"
            required
            autoFocus
          />
        </div>
        
        <div>
          <label 
            htmlFor="task-description" 
            className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5"
          >
            Descripción <span className="text-[var(--text-muted)]">(opcional)</span>
          </label>
          <textarea
            id="task-description"
            className="input-field min-h-[80px] resize-none"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Añade más detalles..."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Priority */}
          <div>
            <label 
              htmlFor="task-priority" 
              className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5"
            >
              <div className="flex items-center gap-1.5">
                <FlagIcon className="w-4 h-4" />
                Prioridad
              </div>
            </label>
            <select
              id="task-priority"
              className="input-field"
              value={priority}
              onChange={e => setPriority(e.target.value as TaskPriority)}
            >
              {PRIORITY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Due Date */}
          <div>
            <label 
              htmlFor="task-due-date" 
              className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5"
            >
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4" />
                Fecha límite
              </div>
            </label>
            <input
              id="task-due-date"
              type="date"
              className="input-field"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
            />
            <p className="text-xs opacity-60 mt-1">
              Fecha de fin. La de inicio va justo debajo.
            </p>
          </div>

          {/* Start Date */}
          <div>
            <label
              htmlFor="task-start-date"
              className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5"
            >
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4" />
                Fecha de inicio
              </div>
            </label>
            <input
              id="task-start-date"
              type="date"
              className="input-field"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
        </div>

        {/* Projects and contexts: the two tags the file speaks in */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label
              htmlFor="task-projects"
              className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5"
            >
              <div className="flex items-center gap-1.5">
                <FolderIcon className="w-4 h-4" />
                Proyectos
                <kbd className="ml-auto text-xs opacity-60">+</kbd>
              </div>
            </label>
            <input
              id="task-projects"
              className="input-field font-mono"
              placeholder="casa trabajo"
              value={projects}
              onChange={e => setProjects(e.target.value)}
            />
            <p className="text-xs opacity-60 mt-1">Separados por espacio. Van como +proyecto.</p>
          </div>

          <div>
            <label
              htmlFor="task-contexts"
              className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5"
            >
              <div className="flex items-center gap-1.5">
                <TagIcon className="w-4 h-4" />
                Contextos
                <kbd className="ml-auto text-xs opacity-60">c</kbd>
              </div>
            </label>
            <input
              id="task-contexts"
              className="input-field font-mono"
              placeholder="oficina casa"
              value={contexts}
              onChange={e => setContexts(e.target.value)}
            />
            <p className="text-xs opacity-60 mt-1">Separados por espacio. Van como @contexto.</p>
          </div>
        </div>

        {/* Recurrence */}
        <div className="mt-4">
          <label
            htmlFor="task-recurrence"
            className="block text-sm font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-1.5"
          >
            <div className="flex items-center gap-1.5">
              <ArrowPathIcon className="w-4 h-4" />
              Recurrencia
              <kbd className="ml-auto text-xs opacity-60">r</kbd>
            </div>
          </label>
          <input
            id="task-recurrence"
            className="input-field font-mono"
            placeholder="+1w · daily · eom"
            value={recurrence}
            onChange={e => setRecurrence(e.target.value)}
          />
          <p className="text-xs opacity-60 mt-1">
            El literal del token rec:. +1d +1w +1m +1y, o daily, weekly, monthly, eom.
          </p>
        </div>
        
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn-primary"
          >
            {isEditing ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </form>
    </div>
  );
};
