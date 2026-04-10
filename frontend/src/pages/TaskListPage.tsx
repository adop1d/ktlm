import { FC, useState, useMemo, useRef } from 'react';
import { useTasks } from '../hooks/useTasks';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { TaskCard } from '../components/task/TaskCard';
import { TaskForm } from '../components/task/TaskForm';
import { Header } from '../components/common/Header';
import { TaskListSkeleton, TaskFormSkeleton, PageHeaderSkeleton } from '../components/common/Skeleton';
import { Task } from '../types/task';
import { useUIStore } from '../stores/uiStore';
import { useToastStore } from '../stores/toastStore';
import { PlusIcon, ClipboardDocumentListIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';

type FilterType = 'all' | 'active' | 'completed';
type SortType = 'newest' | 'oldest' | 'alphabetical';

export const TaskListPage: FC = () => {
  const { tasks, isLoading, error, createTask, updateTask, deleteTask, toggleTask } = useTasks();
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const darkMode = useUIStore(state => state.darkMode);
  const toggleDark = useUIStore(state => state.toggleDarkMode);
  const addToast = useToastStore(state => state.addToast);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  // Filter/Search state
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortType>('newest');

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

  // Filtered and sorted tasks
  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    
    let result = [...tasks];
    
    // Filter by status
    if (filter === 'active') {
      result = result.filter(t => !t.completed);
    } else if (filter === 'completed') {
      result = result.filter(t => t.completed);
    }
    
    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(t => 
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
    
    return result;
  }, [tasks, filter, search, sort]);

  const counts = useMemo(() => ({
    all: tasks?.length ?? 0,
    active: tasks?.filter(t => !t.completed).length ?? 0,
    completed: tasks?.filter(t => t.completed).length ?? 0,
  }), [tasks]);

  const FILTER_TABS: { value: FilterType; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Pendientes' },
    { value: 'completed', label: 'Completadas' },
  ];

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
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Filter Tabs + Sort */}
        <div className="flex items-center justify-between mb-4">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)] rounded-[var(--radius-md)]">
            {FILTER_TABS.map(tab => (
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
                  {counts[tab.value]}
                </span>
              </button>
            ))}
          </div>
          
          {/* Sort dropdown */}
          <div className="relative">
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortType)}
              className="appearance-none pl-8 pr-3 py-1.5 text-sm bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)] text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] rounded-[var(--radius-md)] border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            >
              <option value="newest">Más recientes</option>
              <option value="oldest">Más antiguas</option>
              <option value="alphabetical">Alfabético</option>
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
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center animate-bounce-in">
            <div className="w-16 h-16 mb-4 rounded-full bg-[var(--surface-elevated)] dark:bg-[var(--dark-surface-elevated)] flex items-center justify-center animate-float" style={{ animationDelay: '0.2s' }}>
              <ClipboardDocumentListIcon className="h-8 w-8 text-[var(--text-muted)]" />
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)] dark:text-[var(--dark-text-primary)] mb-1">
              {search || filter !== 'all' ? 'No hay resultados' : 'No hay tareas'}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] dark:text-[var(--dark-text-secondary)] mb-4">
              {search || filter !== 'all' 
                ? 'Prueba con otros filtros' 
                : 'Crea tu primera tarea para comenzar'
              }
            </p>
            {!search && filter === 'all' && (
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
          <div className="grid gap-3 stagger-children">
            {filteredTasks.map(t => (
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
      </section>
    </>
  );
};
