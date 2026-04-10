import { FC } from 'react';
import { Task } from '../../types/task';
import { CheckCircleIcon, XCircleIcon, PencilIcon, TrashIcon, CalendarIcon, FlagIcon, ClockIcon } from '@heroicons/react/24/outline';

type Props = {
  task: Task;
  onToggle: (id: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
};

const PRIORITY_STYLES = {
  HIGH: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  LOW: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

const PRIORITY_LABELS = {
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

export const TaskCard: FC<Props> = ({ task, onToggle, onEdit, onDelete }) => {
  const isCompleted = task.completed;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isCompleted;
  
  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) return 'Hoy';
    if (date.toDateString() === tomorrow.toDateString()) return 'Mañana';
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };
  
  const formatCreatedDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  return (
    <div 
      className={`
        group task-card flex items-start gap-4
        ${isCompleted ? 'completed' : ''}
        cursor-pointer
        relative
        before:absolute
        before:top-0
        before:right-0
        before:w-8
        before:h-8
        before:bg-[var(--color-accent)]
        before:clip-corner
        before:opacity-0
        group-hover:before:opacity-100
        before:transition-opacity
        before:duration-200
      `}
      style={{ 
        animationDelay: `${(task.sortOrder ?? task.id) * 30}ms`,
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
    >
      {/* Corner cut decoration */}
      <div 
        className="absolute top-0 right-0 w-0 h-0"
        style={{
          width: 0,
          height: 0,
          borderLeft: '20px solid transparent',
          borderTop: '20px solid var(--color-accent)',
          opacity: 0.15,
        }}
      />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 
          className={`
            font-medium text-[var(--text-primary)] dark:text-[var(--dark-text-primary)]
            truncate transition-all
            ${isCompleted ? 'line-through text-[var(--text-muted)]' : ''}
          `}
        >
          {task.title}
        </h3>
        
        {task.description && (
          <p 
            className="
              text-sm text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)]
              mt-1 line-clamp-2
            "
          >
            {task.description}
          </p>
        )}
        
        {/* Meta info: priority + due date */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_STYLES[task.priority]}`}>
            <FlagIcon className="w-3 h-3 inline mr-1" />
            {PRIORITY_LABELS[task.priority]}
          </span>
          
          {task.dueDate && (
            <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${
              isOverdue 
                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
            }`}>
              <CalendarIcon className="w-3 h-3" />
              {formatDueDate(task.dueDate)}
            </span>
          )}
          
          {/* Created date - Neo-Tokyo style */}
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-primary-muted)] text-[var(--color-primary)] flex items-center gap-1 font-mono">
            <ClockIcon className="w-3 h-3" />
            {formatCreatedDate(task.createdAt)}
          </span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--transition-fast)]">
        <button
          onClick={() => onToggle(task.id)}
          className={`
            p-1.5 rounded-[var(--radius-sm)] transition-all duration-[var(--transition-fast)]
            hover:bg-[var(--color-primary-muted)]
            hover:scale-110
            ${isCompleted 
              ? 'text-emerald-500 hover:text-emerald-600' 
              : 'text-[var(--text-muted)] hover:text-emerald-500'
            }
          `}
          title={isCompleted ? 'Marcar como pendiente' : 'Marcar como completada'}
        >
          {isCompleted ? (
            <CheckCircleIcon className="h-5 w-5" />
          ) : (
            <XCircleIcon className="h-5 w-5" />
          )}
        </button>
        
        <button 
          onClick={() => onEdit(task)} 
          className="
            p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] 
            hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20
            hover:scale-110
            transition-all duration-[var(--transition-fast)]
          "
          title="Editar"
        >
          <PencilIcon className="h-5 w-5" />
        </button>
        
        <button 
          onClick={() => onDelete(task.id)} 
          className="
            p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] 
            hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20
            hover:scale-110
            transition-all duration-[var(--transition-fast)]
          "
          title="Eliminar"
        >
          <TrashIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
