import { FC, useState, useEffect, useRef } from 'react';
import { useTasks } from '../hooks/useTasks';
import { DEFAULT_NORMAL_KEYMAP } from '../keymap/defaults';
import { useKeymap } from '../keymap/useKeymap';
import { HelpOverlay } from '../keymap/HelpOverlay';
import { CommandPalette } from '../keymap/CommandPalette';
import { PromptOverlay } from '../keymap/PromptOverlay';
import { StatusBar } from '../keymap/StatusBar';
import { FilterPane } from '../file/FilterPane';
import { DetailPane } from '../file/DetailPane';
import type { ActionName } from '../keymap/actions';
import { TaskRow } from '../components/task/TaskRow';
import { TaskForm } from '../components/task/TaskForm';
import { Header } from '../components/common/Header';
import { TaskListSkeleton, TaskFormSkeleton, PageHeaderSkeleton } from '../components/common/Skeleton';
import { Task, TaskFilter, TaskSort } from '../types/task';
import { TodoFileBar } from '../file/TodoFileBar';
import { useTodoFile } from '../file/useTodoFile';
import { useTodoDoc } from '../file/todoDoc';
import { useToastStore } from '../stores/toastStore';
import { ClipboardDocumentListIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, ArrowsUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

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
  const [project, setProject] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
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
    project: project ?? undefined,
    context: context ?? undefined,
  });
  const [editing, setEditing] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const addToast = useToastStore(state => state.addToast);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const todoFile = useTodoFile();
  const [showHelp, setShowHelp] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [recurrenceTarget, setRecurrenceTarget] = useState<Task | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [visual, setVisual] = useState<number[]>([]);

  const rows = data?.content ?? [];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Único sitio donde se vuelve a la primera página: cambiar qué se lista
  // invalida la página actual y dejaría al usuario en una página vacía.
  useEffect(() => {
    setPage(0);
  }, [filter, debouncedSearch, sort, project, context]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const moveCursor = (delta: number) => {
    setCursor((current) => Math.max(0, Math.min(current + delta, rows.length - 1)));
  };

  const halfPage = (delta: number) => {
    if (delta > 0 && data?.hasNext) {
      setPage((p) => p + 1);
      setCursor(0);
      return;
    }
    if (delta < 0 && data?.hasPrevious) {
      setPage((p) => p - 1);
      setCursor(Math.max(0, PAGE_SIZE - 1));
      return;
    }
    moveCursor(delta * Math.floor(PAGE_SIZE / 2));
  };

  const onKeyAction = (action: ActionName) => {
    const task = rows[cursor];
    switch (action) {
      case 'cursor_down':
        return moveCursor(1);
      case 'cursor_up':
        return moveCursor(-1);
      case 'cursor_top':
        return setCursor(0);
      case 'cursor_bottom':
        return setCursor(Math.max(0, rows.length - 1));
      case 'half_page_down':
        return halfPage(1);
      case 'half_page_up':
        return halfPage(-1);
      case 'begin_add':
      case 'begin_edit':
      case 'begin_edit_insert':
        setEditing(null);
        setShowForm(true);
        return;
      case 'toggle_complete':
        return task ? void todoFile.toggleComplete(task.sortOrder) : undefined;
      case 'delete':
        if (!task) return;
        if (visual.length > 0) {
          visual.forEach((index) => void todoFile.remove(rows[index].sortOrder));
          setVisual([]);
          return;
        }
        return void todoFile.remove(task.sortOrder);
      case 'cycle_priority':
        return task ? void todoFile.cyclePriority(task.sortOrder) : undefined;
      case 'move_task_down':
        return task ? void todoFile.move(task.sortOrder, 1) : undefined;
      case 'move_task_up':
        return task ? void todoFile.move(task.sortOrder, -1) : undefined;
      case 'undo':
        return void todoFile.undo();
      case 'archive_completed':
        return void todoFile.archive();
      case 'reschedule':
        // `r` abre el prompt de recurrencia; es la tecla que tuxedo usa para el mismo builder.
        setRecurrenceTarget(rows[cursor] ?? null);
        return;
      case 'toggle_visual':
        setVisual((current) => (current.length > 0 ? [] : [cursor]));
        return;
      case 'toggle_selected':
        setVisual((current) =>
          current.includes(cursor)
            ? current.filter((i) => i !== cursor)
            : [...current, cursor].sort((a, b) => a - b)
        );
        return;
      case 'begin_search':
        searchInputRef.current?.focus();
        return;
      case 'open_help':
        setShowHelp(true);
        return;
      case 'toggle_left_pane':
        setShowLeft((current) => !current);
        return;
      case 'toggle_right_pane':
        setShowRight((current) => !current);
        return;
      case 'pick_project':
        setShowLeft((current) => !current);
        return;
      case 'pick_context':
        setShowLeft((current) => !current);
        return;
      case 'open_command_palette':
        setShowPalette(true);
        return;
      default:
        return;
    }
  };

  // Las acciones que mutan datos pasan por el todo.txt. Sin archivo vinculado no hay uid
  // sobre el que actuar, y fingir que funcionan es peor que mostrarlas apagadas.
  const isLinked = useTodoDoc((state) => state.status === 'linked' || state.status === 'in-memory');
  const fileBackedActions: readonly ActionName[] = [
    'toggle_complete',
    'delete',
    'cycle_priority',
    'move_task_down',
    'move_task_up',
    'undo',
    'archive_completed',
    'copy_line',
    'copy_body',
  ];

  const { mode, pendingChord } = useKeymap({
    keymap: DEFAULT_NORMAL_KEYMAP,
    onAction: onKeyAction,
    enabled: !isLoading,
    unavailable: isLinked
      ? undefined
      : { actions: fileBackedActions, reason: 'Abre un todo.txt para editar sobre el archivo' },
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
        {/* Cabecera: una linea, como el titulo de una ventana de terminal */}
        <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-[var(--border-default)]">
          <h1 className="text-sm font-bold tracking-wide text-[var(--text-primary)]">
            tareas
            <span className="ml-2 font-normal text-[var(--text-muted)]">
              {data ? `${data.totalElements} en total` : ''}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeft((current) => !current)}
              aria-pressed={showLeft}
              className="btn-ghost text-xs"
              title="Panel de filtros ( [ )"
            >
              [ filtros
            </button>
            <button
              onClick={() => setShowRight((current) => !current)}
              aria-pressed={showRight}
              className="btn-ghost text-xs"
              title="Panel de detalle ( ] )"
            >
              detalle ]
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="btn-primary text-xs"
            >
              + nueva
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

        {/* Cuerpo: panel izquierdo, lista, panel derecho */}
        <div
          className={`tui-body tui-with-status ${
            showLeft && showRight
              ? 'tui-body--both'
              : showLeft
                ? 'tui-body--left'
                : showRight
                  ? 'tui-body--right'
                  : ''
          }`}
        >
          {showLeft ? (
            <FilterPane
              tasks={rows}
              activeProject={project}
              activeContext={context}
              onPickProject={(next) => {
                setProject(next);
                setPage(0);
              }}
              onPickContext={(next) => {
                setContext(next);
                setPage(0);
              }}
            />
          ) : null}

          <div>
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
          <div className={`tui-list transition-opacity ${isFetching ? 'opacity-60' : ''}`}>
            {rows.map((task, index) => (
              <TaskRow
                key={task.id}
                index={index}
                task={task}
                isCursor={index === cursor}
                isSelected={visual.includes(index)}
                onFocus={setCursor}
                onToggle={handleToggle}
                onEdit={(task) => {
                  setEditing(task);
                  setShowForm(true);
                  setCursor(index);
                }}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

          </div>

          {showRight ? <DetailPane task={rows[cursor]} /> : null}
        </div>

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

      <StatusBar
        mode={mode}
        pendingChord={pendingChord}
        position={
          rows.length
            ? `${cursor + 1}/${rows.length}${data ? ` · pág ${data.page + 1}/${data.totalPages}` : ''}`
            : '0/0'
        }
        counts={counts}
        linked={isLinked}
        hints={[
          { keys: 'j k', label: 'mover' },
          { keys: 'n', label: 'nueva' },
          { keys: '[ ]', label: 'paneles' },
          { keys: ':', label: 'paleta' },
          { keys: '?', label: 'ayuda' },
        ]}
      />

      {showPalette && (
        <CommandPalette
          keymap={DEFAULT_NORMAL_KEYMAP}
          unavailable={
            isLinked
              ? undefined
              : { actions: fileBackedActions, reason: 'sin todo.txt vinculado, no hay uid' }
          }
          onRun={(action) => {
            setShowPalette(false);
            onKeyAction(action);
          }}
          onClose={() => setShowPalette(false)}
        />
      )}

      {recurrenceTarget && (
        <PromptOverlay
          title={`Recurrencia: ${recurrenceTarget.title}`}
          hint="Vaciar la quita la recurrencia. Formato de tuxedo: +1d, 2w, +1m, 3b (hábiles), 1y. Con + el ancla es la fecha anterior."
          initial={recurrenceTarget.recurrence ?? ''}
          submitLabel="Aplicar"
          onSubmit={(value) => {
            const target = recurrenceTarget;
            setRecurrenceTarget(null);
            void todoFile.setRecurrence(target.sortOrder, value || null);
          }}
          onCancel={() => setRecurrenceTarget(null)}
        />
      )}

      {showHelp && (
        <HelpOverlay
          keymap={DEFAULT_NORMAL_KEYMAP}
          onClose={() => setShowHelp(false)}
          unavailable={
            isLinked
              ? undefined
              : { actions: fileBackedActions, reason: 'sin todo.txt vinculado, no hay uid' }
          }
        />
      )}
    </>
  );
};