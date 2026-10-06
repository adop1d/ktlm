import { FC, useState, useEffect, useRef } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { TaskCard } from '../components/task/TaskCard';
import { TaskForm } from '../components/task/TaskForm';
import { Header } from '../components/common/Header';
import { TaskListSkeleton, TaskFormSkeleton, PageHeaderSkeleton } from '../components/common/Skeleton';
import { Task, TaskFilter, TaskSort } from '../types/task';
import { TodoFileBar } from '../file/TodoFileBar';
import { useTodoFile } from '../file/useTodoFile';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { PlusIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, ArrowsUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const PAGE_SIZE = 20;

const FILTER_TABS: { value: TaskFilter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Pendientes' },
  { value: 'completed', label: 'Completadas' },
];

const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: 'file', label: 'Orden del archivo' },
  { value: 'priority', label: 'Prioridad' },
  { value: 'due', label: 'Vencimiento' },
  { value: 'newest', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguas' },
  { value: 'alphabetical', label: 'Alfabético' },
];

export const TaskListPage: FC = () => {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<TaskSort>('file');
  const [page, setPage] = useState(0);
  const { page: data, counts, isLoading, isFetching, error, createTask, updateTask, deleteTask, toggleTask } = useTasks({
    page,
    size: PAGE_SIZE,
    filter,
    q: debouncedSearch,
    sort,
  });
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const darkMode = useUIStore(state => state.darkMode);
  const toggleDark = useUIStore(state => state.toggleDarkMode);
  const addToast = useToastStore(state => state.addToast);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const todoFile = useTodoFile();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Único sitio donde se vuelve a la primera página: cambiar qué se lista
  // invalida la página actual y dejaría al usuario en una página vacía.
  useEffect(() => {
    setPage(0);
  }, [filter, debouncedSearch, sort]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onNewTask: () => {
      setEditing(null);
      setShowForm(true);
    },
    onFocusSearch: () => {
      searchInputRef.current?.focus();
    },
    onEscape: () => {
      if (showForm) {
        setShowForm(false);
        setEditing(null);
      } else if (search) {
        setSearch('');
      }
    },
    enabled: !isLoading,
  });

  const handleSubmit = (data: Partial<Task>) => {
    if (editing) {
      updateTask(editing.id, data);
      addToast('success', 'Tarea actualizada');
    } else {
      createTask(data);
      addToast('success', 'Tarea creada');
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = (id: number) => {
    deleteTask(id);
    addToast('success', 'Tarea eliminada');
  };

  const handleToggle = (id: number) => {
    toggleTask(id);
  };

  // Loading state with skeletons
  if (isLoading) {
    return (
      <>
        <Header />
        <section className="max-w-2xl mx-auto py-8 px-4">
          <PageHeaderSkeleton />
          <TaskFormSkeleton />
          <div className="mt-6">
            <TaskListSkeleton count={5} />
          </div>
        </section>
      </>
    );
  }

  // Error state
  if (error) {
    return (
      <>
        <Header />
        <section className="max-w-2xl mx-auto py-8 px-4">
          <div className="flex flex-col items-center justify-center py-16 text-center animate-bounce-in">
            <div className="w-16 h-16 mb-4 rounded-full bg-[var(--color-danger-muted)] flex items-center justify-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-[var(--color-danger)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)] dark:text-[var(--dark-text-primary)] mb-1">
              Error al cargar
            </h3>
            <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-4">
              {error instanceof Error ? error.message : 'Algo salió mal'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-primary hover:animate-button-press"
            >
              Reintentar
            </button>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Header />
      <section className="max-w-2xl mx-auto py-8 px-4">
        <TodoFileBar
          onOpen={() => void todoFile.openAndLink()}
          onSaveAs={() => void todoFile.saveAs()}
          onDetach={todoFile.detach}
        />
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] dark:text-[var(--dark-text-primary)]">
              Mis tareas
            </h1>
            {/* Shortcuts - compact under title */}
            <div className="flex items-center gap-2 mt-2 text-xs text-[var(--text-muted)] dark:text-[var(--dark-text-muted)]">
              <kbd className="px-1.5 py-0.5 bg-[var(--color-accent)] text-white rounded font-mono font-bold text-[10px]">N</kbd>
              <span>nueva</span>
              <span className="opacity-50">|</span>
              <kbd className="px-1.5 py-0.5 bg-[var(--color-accent)] text-white rounded font-mono font-bold text-[10px]">/</kbd>
              <span>buscar</span>
              <span className="opacity-50">|</span>
              <kbd className="px-1.5 py-0.5 bg-[var(--color-accent)] text-white rounded font-mono font-bold text-[10px]">Esc</kbd>
              <span>cerrar</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="btn-primary flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              Nueva
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
          <input
            ref={searchInputRef}
            type="text"
            className="input-field pl-10"
            placeholder="Buscar tareas... (/)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Tabs + Sort */}
        <div className="flex items-center justify-between mb-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)] rounded-[var(--radius-md)]">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`
                  px-3 py-1.5 text-sm font-medium rounded-[var(--radius-sm)] transition-all
                  ${filter === tab.value
                    ? 'bg-[var(--surface-base)] dark:bg-[var(--dark-surface-base)] text-[var(--text-primary)] dark:text-[var(--dark-text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] hover:text-[var(--text-primary)] dark:hover:text-[var(--dark-text-primary)]'
                  }
                `}
              >
                {tab.label}
                <span className="ml-1.5 text-xs opacity-70">
                  {counts?.[tab.value] ?? '–'}
                </span>
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as TaskSort)}
              className="appearance-none pl-8 pr-3 py-1.5 text-sm bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)] text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] rounded-[var(--radius-md)] border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ArrowsUpDownIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-[var(--text-muted)]" />
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="mb-6">
            <TaskForm
              initial={editing ?? undefined}
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
            />
          </div>
        )}

        {/* Content */}
        {(data?.content.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-bounce-in">
            <div className="w-16 h-16 mb-4 rounded-full bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)] flex items-center justify-center animate-float" style={{ animationDelay: '0.2s' }}>
              <ClipboardDocumentListIcon className="h-8 w-8 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)] dark:text-[var(--dark-text-primary)] mb-1">
              {debouncedSearch || filter !== 'all' ? 'No hay resultados' : 'No hay tareas'}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-4">
              {debouncedSearch || filter !== 'all'
                ? 'Prueba con otros filtros'
                : 'Crea tu primera tarea para comenzar'
              }
            </p>
            {!debouncedSearch && filter === 'all' && (
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="btn-primary hover:animate-button-press"
              >
                Crear tarea
              </button>
            )}
          </div>
        ) : (
          <div className={`grid gap-3 stagger-children transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            {data?.content.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onToggle={handleToggle}
                onEdit={(task) => {
                  setEditing(task);
                  setShowForm(true);
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <nav className="flex items-center justify-between gap-2 mt-6 pt-4 border-t border-[var(--border-default)]" aria-label="Paginación">
            <span className="text-xs text-[var(--text-muted)] dark:text-[var(--dark-text-muted)]">
              mostrando {data.page * data.size + 1}–{Math.min((data.page + 1) * data.size, data.totalElements)} de {data.totalElements}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                disabled={!data.hasPrevious || isFetching}
                className="btn-ghost flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeftIcon className="w-4 h-4" />
                Anterior
              </button>
              <span className="text-xs font-medium text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] tabular-nums">
                página {data.page + 1} de {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={!data.hasNext || isFetching}
                className="btn-ghost flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Siguiente
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </nav>
        )}
      </section>
    </>
  );
};