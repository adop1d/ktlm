import { FC, useState, useEffect, useRef, useCallback } from 'react';
import { NoteEditor } from '../components/task/NoteEditor';
import { LineEditor, toEditable, type EditableTask, type SegmentId } from '../components/task/LineEditor';
import { useT } from '../i18n';
import { ShareQr } from '../components/common/ShareQr';
import { THEMES, THEME_LABELS, useUIStore } from '../stores/uiStore';
import { useTasks } from '../hooks/useTasks';
import { useTaskStream } from '../hooks/useTaskStream';
import { DEFAULT_NORMAL_KEYMAP } from '../keymap/defaults';
import { useKeymap } from '../keymap/useKeymap';
import { HelpOverlay } from '../keymap/HelpOverlay';
import { CommandPalette } from '../keymap/CommandPalette';
import { PromptOverlay } from '../keymap/PromptOverlay';
import { StatusBar } from '../keymap/StatusBar';
import { FilterPane } from '../file/FilterPane';
import { DetailPane } from '../file/DetailPane';
import { SavedFilterPicker } from '../keymap/SavedFilterPicker';
import {
  SavedFilter,
  isEmptyFilter,
  useSavedFilters,
} from '../stores/savedSearchesStore';
import type { ActionName } from '../keymap/actions';
import { TaskRow } from '../components/task/TaskRow';
import { TaskForm } from '../components/task/TaskForm';
import { Header } from '../components/common/Header';
import { TaskListSkeleton, TaskFormSkeleton, PageHeaderSkeleton } from '../components/common/Skeleton';
import { Task, TaskFilter, TaskSort } from '../types/task';
import { TodoFileBar } from '../file/TodoFileBar';
import { useTodoFile } from '../file/useTodoFile';
import { useTodoDoc } from '../file/todoDoc';
import { parseTodoLine } from '../file/todoLine';
import { useToastStore } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { ClipboardDocumentListIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, ArrowsUpDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const PAGE_SIZE = 20;

/** The `S` cycle: tuxedo's three plus the ones the app already had. */
const SORT_CYCLE: Record<TaskSort, TaskSort> = {
  file: 'priority',
  priority: 'due',
  due: 'file',
  newest: 'file',
  oldest: 'file',
  alphabetical: 'file',
};

const FILTER_TABS: { value: TaskFilter; key: string }[] = [
  { value: 'all', key: 'filter.tab.all' },
  { value: 'active', key: 'filter.tab.active' },
  { value: 'completed', key: 'filter.tab.completed' },
];

const SORT_OPTIONS: { value: TaskSort; key: string }[] = [
  { value: 'file', key: 'sort.file' },
  { value: 'priority', key: 'sort.priority' },
  { value: 'due', key: 'sort.due' },
  { value: 'newest', key: 'sort.newest' },
  { value: 'oldest', key: 'sort.oldest' },
  { value: 'alphabetical', key: 'sort.alphabetical' },
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
  // One listener per screen: the server pushes, the client does not ask.
  useTaskStream();
  const [showHelp, setShowHelp] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [recurrenceTarget, setRecurrenceTarget] = useState<Task | null>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [visual, setVisual] = useState<number[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [namingFilter, setNamingFilter] = useState(false);
  const [archive, setArchive] = useState<string[] | null>(null);

  const username = useAuthStore((state) => state.username) ?? 'anon';
  const savedFilters = useSavedFilters((state) => state.byUser[username] ?? []);
  const saveFilter = useSavedFilters((state) => state.save);
  const removeFilter = useSavedFilters((state) => state.remove);

  /** Whatever is open right now, which is what gets saved with fs. */
  const currentFilter = {
    q: debouncedSearch,
    filter,
    project,
    context,
    sort,
  };

  const rows = data?.content ?? [];

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // The only place that goes back to the first page: changing what is listed
  // invalidates the current page and would leave the user on an empty one.
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

  const onKeyAction = async (action: ActionName) => {
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
        setEditing(null);
        setShowForm(true);
        return;
      // `E` is the long form of the same thing: the box, for when you would rather click.
      case 'begin_edit_form':
        if (!task) return;
        setEditing(task);
        setShowForm(true);
        return;
      case 'begin_edit':
      case 'begin_edit_insert':
        // e and i edit the task under the cursor. Opening a blank form here was opening
        // a new task with the edit key.
        if (!task) return;
        openLineEditor(task);
        return;
      case 'cycle_sort':
        setSort(SORT_CYCLE[sort]);
        return;
      case 'copy_line':
        return copyLine(task?.sortOrder);
      case 'copy_body':
        return copyBody(task?.sortOrder);
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
        // `r` opens the recurrence prompt; it is the key tuxedo uses for the same builder.
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
      case 'open_share':
        setShowQr(true);
        return;
      // Appearance: these are global, so they go to the store and not to this page's state.
      case 'cycle_theme':
        cycleTheme();
        return;
      case 'open_theme_picker':
        setThemeMenu((open) => !open);
        return;
      case 'cycle_density':
        cycleDensity();
        return;
      case 'toggle_line_num':
        toggleLineNumbers();
        return;
      case 'note_new':
      case 'note_open': {
        const task = rows[cursor];
        if (!task) {
          addToast('info', 'No hay ninguna tarea debajo del cursor');
          return;
        }
        // `O` in tuxedo opens the note if there is one; here both keys open the editor,
        // which with an empty note is an empty editor. A warning, not a no-op.
        if (action === 'note_open' && !task.note) {
          addToast('info', 'Esa tarea todavía no tiene nota');
        }
        // id, not sortOrder: sortOrder is the position in the file and the note endpoint
        // talks about the row. With the first task, sortOrder is 0 and there is no task 0.
        setNota({ uid: task.id, titulo: task.title });
        return;
      }
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
      case 'save_current_filter':
        if (isEmptyFilter(currentFilter)) {
          addToast('info', 'No hay nada que guardar: la búsqueda está vacía');
          return;
        }
        setNamingFilter(true);
        return;
      case 'pick_saved_filter':
        setShowPicker(true);
        return;
      case 'toggle_archive_view':
        if (archive === null) {
          setArchive(await todoFile.readArchive());
        } else {
          setArchive(null);
        }
        return;
      case 'open_command_palette':
        setShowPalette(true);
        return;
      default:
        return;
    }
  };

  // Actions that mutate data go through the todo.txt. With no linked file there is no uid
  // to act on, and pretending they work is worse than showing them dimmed.
  const isLinked = useTodoDoc((state) => state.status === 'linked' || state.status === 'in-memory');
  const t = useT();
  const [nota, setNota] = useState<{ uid: number; titulo: string } | null>(null);

  // The line editor: the task as a todo.txt line, with the cursor on one of its parts.
  const [linea, setLinea] = useState<EditableTask | null>(null);
  const [segmento, setSegmento] = useState<SegmentId>('title');
  const [prompt, setPrompt] = useState({ visible: false, label: '', value: '', kind: 'title' as SegmentId });

  const openLineEditor = useCallback(
    (task: Task) => {
      setLinea(toEditable(task));
      setSegmento('title');
      setPrompt({ visible: false, label: '', value: '', kind: 'title' });
    },
    []
  );
  const [themeMenu, setThemeMenu] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const cycleTheme = useUIStore((state) => state.cycleTheme);
  const setTheme = useUIStore((state) => state.setTheme);
  const cycleDensity = useUIStore((state) => state.cycleDensity);
  const toggleLineNumbers = useUIStore((state) => state.toggleLineNumbers);

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

  /** Copies the line exactly as it is in the file: that, and not the title, is what you take away. */
  const copyLine = async (sortOrder?: number) => {
    if (sortOrder === undefined) return;
    const { lines, uidByLine } = useTodoDoc.getState();
    const index = uidByLine.findIndex((uid) => uid === String(sortOrder));
    const line = index >= 0 ? lines[index] : undefined;
    if (!line) return;
    await navigator.clipboard.writeText(line);
    addToast('success', 'Línea copiada');
  };

  /** Copies only the body, without priority, dates or tags. */
  const copyBody = async (sortOrder?: number) => {
    if (sortOrder === undefined) return;
    const { lines, uidByLine } = useTodoDoc.getState();
    const index = uidByLine.findIndex((uid) => uid === String(sortOrder));
    const line = index >= 0 ? lines[index] : undefined;
    if (!line) return;
    const body = parseTodoLine(line).body;
    await navigator.clipboard.writeText(body);
    addToast('success', 'Texto copiado');
  };

  const { mode, pendingChord } = useKeymap({
    keymap: DEFAULT_NORMAL_KEYMAP,
    onAction: onKeyAction,
    enabled: !isLoading,
    // Esc closes the overlay above, in this order: help, palette, filter, prompt.
    onEscape: () => {
      setShowHelp(false);
      setShowPicker(false);
      setNamingFilter(false);
      setRecurrenceTarget(null);
    },
    unavailable: isLinked
      ? undefined
      : { actions: fileBackedActions, reason: 'Abre un todo.txt para editar sobre el archivo' },
  });

  /**
   * Saving the line editor.
   *
   * <p>Only the parts the line editor owns are sent. The fields the visual form has and this
   * one does not — the start date, for one — are left out on purpose: a null in a patch means
   * "unchanged" on the server, so leaving them out is how they survive.
   */
  const guardarLinea = useCallback(async () => {
    if (!linea) return;
    const uid = linea.uid;
    if (!uid) {
      addToast('error', 'Esa tarea no tiene uid: no se puede editar desde aquí');
      return;
    }
    try {
      await todoFile.updateFromLine({
        uid,
        title: linea.title,
        priority: linea.priority,
        projects: linea.projects,
        contexts: linea.contexts,
        dueDate: linea.due,
        recurrence: linea.recurrence,
      });
      addToast('success', 'Guardado');
      setLinea(null);
    } catch (error) {
      addToast('error', `No se pudo guardar: ${(error as Error).message}`);
    }
  }, [linea, addToast]);

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

      {linea ? (
        <LineEditor
          value={linea}
          segment={segmento}
          onSegment={setSegmento}
          onChange={setLinea}
          onCommit={() => void guardarLinea()}
          onCancel={() => setLinea(null)}
          prompt={prompt}
          onPrompt={(label, kind, initial) => setPrompt({ visible: true, label, kind, value: initial })}
          onPromptChange={(value) => setPrompt((current) => ({ ...current, value }))}
          onPromptCancel={() => setPrompt((current) => ({ ...current, visible: false }))}
          onPromptAccept={() => {
            const { kind, value } = prompt;
            setPrompt((current) => ({ ...current, visible: false }));
            if (!value.trim()) return;
            setLinea((current) => {
              if (!current) return current;
              switch (kind) {
                case 'projects':
                  return { ...current, projects: [...new Set([...current.projects, value.trim().replace(/^\+/, '')])] };
                case 'contexts':
                  return { ...current, contexts: [...new Set([...current.contexts, value.trim().replace(/^@/, '')])] };
                case 'due':
                  return { ...current, due: value.trim() };
                case 'rec':
                  return { ...current, recurrence: value.trim() };
                default:
                  return current;
              }
            });
          }}
        />
      ) : null}

      {nota ? (
        <NoteEditor
          uid={nota.uid}
          title={nota.titulo}
          onClose={() => setNota(null)}
        />
      ) : null}

      {showQr ? <ShareQr onClose={() => setShowQr(false)} /> : null}

      {themeMenu ? (
        <div className="fixed top-12 right-4 z-40 tui-panel p-2">
          {THEMES.map((nombre) => (
            <button
              key={nombre}
              type="button"
              onClick={() => {
                setTheme(nombre);
                setThemeMenu(false);
              }}
              className="block w-full text-left text-xs px-2 py-1 btn-ghost"
            >
              {THEME_LABELS[nombre]}
            </button>
          ))}
        </div>
      ) : null}
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

      {linea ? (
        <LineEditor
          value={linea}
          segment={segmento}
          onSegment={setSegmento}
          onChange={setLinea}
          onCommit={() => void guardarLinea()}
          onCancel={() => setLinea(null)}
          prompt={prompt}
          onPrompt={(label, kind, initial) => setPrompt({ visible: true, label, kind, value: initial })}
          onPromptChange={(value) => setPrompt((current) => ({ ...current, value }))}
          onPromptCancel={() => setPrompt((current) => ({ ...current, visible: false }))}
          onPromptAccept={() => {
            const { kind, value } = prompt;
            setPrompt((current) => ({ ...current, visible: false }));
            if (!value.trim()) return;
            setLinea((current) => {
              if (!current) return current;
              switch (kind) {
                case 'projects':
                  return { ...current, projects: [...new Set([...current.projects, value.trim().replace(/^\+/, '')])] };
                case 'contexts':
                  return { ...current, contexts: [...new Set([...current.contexts, value.trim().replace(/^@/, '')])] };
                case 'due':
                  return { ...current, due: value.trim() };
                case 'rec':
                  return { ...current, recurrence: value.trim() };
                default:
                  return current;
              }
            });
          }}
        />
      ) : null}

      {nota ? (
        <NoteEditor
          uid={nota.uid}
          title={nota.titulo}
          onClose={() => setNota(null)}
        />
      ) : null}

      {showQr ? <ShareQr onClose={() => setShowQr(false)} /> : null}

      {themeMenu ? (
        <div className="fixed top-12 right-4 z-40 tui-panel p-2">
          {THEMES.map((nombre) => (
            <button
              key={nombre}
              type="button"
              onClick={() => {
                setTheme(nombre);
                setThemeMenu(false);
              }}
              className="block w-full text-left text-xs px-2 py-1 btn-ghost"
            >
              {THEME_LABELS[nombre]}
            </button>
          ))}
        </div>
      ) : null}
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

      {linea ? (
        <LineEditor
          value={linea}
          segment={segmento}
          onSegment={setSegmento}
          onChange={setLinea}
          onCommit={() => void guardarLinea()}
          onCancel={() => setLinea(null)}
          prompt={prompt}
          onPrompt={(label, kind, initial) => setPrompt({ visible: true, label, kind, value: initial })}
          onPromptChange={(value) => setPrompt((current) => ({ ...current, value }))}
          onPromptCancel={() => setPrompt((current) => ({ ...current, visible: false }))}
          onPromptAccept={() => {
            const { kind, value } = prompt;
            setPrompt((current) => ({ ...current, visible: false }));
            if (!value.trim()) return;
            setLinea((current) => {
              if (!current) return current;
              switch (kind) {
                case 'projects':
                  return { ...current, projects: [...new Set([...current.projects, value.trim().replace(/^\+/, '')])] };
                case 'contexts':
                  return { ...current, contexts: [...new Set([...current.contexts, value.trim().replace(/^@/, '')])] };
                case 'due':
                  return { ...current, due: value.trim() };
                case 'rec':
                  return { ...current, recurrence: value.trim() };
                default:
                  return current;
              }
            });
          }}
        />
      ) : null}

      {nota ? (
        <NoteEditor
          uid={nota.uid}
          title={nota.titulo}
          onClose={() => setNota(null)}
        />
      ) : null}

      {showQr ? <ShareQr onClose={() => setShowQr(false)} /> : null}

      {themeMenu ? (
        <div className="fixed top-12 right-4 z-40 tui-panel p-2">
          {THEMES.map((nombre) => (
            <button
              key={nombre}
              type="button"
              onClick={() => {
                setTheme(nombre);
                setThemeMenu(false);
              }}
              className="block w-full text-left text-xs px-2 py-1 btn-ghost"
            >
              {THEME_LABELS[nombre]}
            </button>
          ))}
        </div>
      ) : null}
      <section className="max-w-2xl mx-auto py-8 px-4">
        <TodoFileBar
          onOpen={() => void todoFile.openAndLink()}
          onImport={() => void todoFile.importFromDisk()}
          onDetach={todoFile.detach}
          canImport={todoFile.isPersistent}
        />
        {/* Cabecera: una linea, como el titulo de una ventana de terminal */}
        <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-[var(--border-default)]">
          <h1 className="text-sm font-bold tracking-wide text-[var(--text-primary)]">
            {t('list.title')}
            <span className="ml-2 font-normal text-[var(--text-muted)]">
              {data ? t('list.total', { count: data.totalElements }) : ''}
            </span>
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLeft((current) => !current)}
              aria-pressed={showLeft}
              className="btn-ghost text-xs"
              title={t('list.filtersPanel.title')}
            >
              {t('list.filtersPanel.button')}
            </button>
            <button
              onClick={() => setShowRight((current) => !current)}
              aria-pressed={showRight}
              className="btn-ghost text-xs"
              title={t('list.detailPanel.title')}
            >
              {t('list.detailPanel.button')}
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setShowForm(true);
              }}
              className="btn-primary text-xs"
            >
              {t('list.newTask')}
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
            placeholder={t('list.search.placeholder')}
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
                {t(tab.key)}
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
                <option key={opt.value} value={opt.value}>{t(opt.key)}</option>
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
        <div className="tui-body tui-with-status">
          {showLeft ? (
            <div className="tui-pane-float tui-pane-float--left">
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
            </div>
          ) : null}

          <div>
        {/* Content */}
        {archive !== null ? (
          <section className="tui-panel p-3" aria-label="Archivo de hechas">
            <span className="tui-panel-title">done.txt</span>
            {archive.length === 0 ? (
              <p className="tui-empty">
                Nada archivado todavía. Con <kbd>A</kbd> mandas las completadas a done.txt.
              </p>
            ) : (
              <div className="tui-list">
                {archive.map((line, index) => (
                  <div key={`${index}-${line}`} className="tui-row tui-row--done">
                    <span className="tui-row-index">{String(index + 1).padStart(3, ' ')}</span>
                    <span className="tui-row-prio">·</span>
                    <span className="tui-row-title">{line}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="tui-empty mt-2">Vista de solo lectura: sale del archivo, no de la base.</p>
          </section>
        ) : (data?.content.length ?? 0) === 0 ? (
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
            <div className="tui-columns" aria-hidden="true">
              <span>#</span>
              <span>P</span>
              <span>Tarea</span>
              <span>meta</span>
            </div>
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
        )
        }

          </div>

          {showRight ? (
            <div
              className={`tui-pane-float tui-pane-float--right${showLeft ? ' tui-pane-float--with-left' : ''}`}
            >
              <DetailPane task={rows[cursor]} />
            </div>
          ) : null}
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
        view={archive !== null ? 'done.txt' : null}
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
            void onKeyAction(action);
          }}
          onClose={() => setShowPalette(false)}
        />
      )}

      {showPicker && (
        <SavedFilterPicker
          filters={savedFilters}
          onApply={(filter: SavedFilter) => {
            setShowPicker(false);
            setSearch(filter.q);
            setFilter(filter.filter);
            setProject(filter.project);
            setContext(filter.context);
            setSort(filter.sort);
            setPage(0);
          }}
          onRemove={(name) => removeFilter(username, name)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {namingFilter && (
        <PromptOverlay
          title="Guardar esta búsqueda"
          hint="El nombre con el que aparecerá en ff. Guardarla dos veces con el mismo nombre la sobrescribe."
          initial={savedFilters[0]?.name ?? ''}
          submitLabel="Guardar"
          onSubmit={(name) => {
            if (name) {
              saveFilter(username, { name, ...currentFilter });
              addToast('success', `Búsqueda «${name}» guardada`);
            }
            setNamingFilter(false);
          }}
          onCancel={() => setNamingFilter(false)}
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