/**
 * In-memory mirror of the user's todo.txt.
 *
 * Invariant: `lines` ⇔ file content ⇔ projection in the database. Mutations patch individual
 * lines rather than reserializing the whole file, and they are grouped into an undo history
 * like tuxedo's. When the file changes from outside, the mirror reloads and the history is
 * dropped, the same way tuxedo does on detecting an external change.
 */
import { create } from 'zustand';
import { advanceIsoDate, formatTodoLine, parseTodoLine } from './todoLine';

const UNDO_DEPTH = 50;
export const POLL_INTERVAL_MS = 400;

/**
 * Closure for the pending write. While it holds, the mirror does not reload: reloading before
 * the write reaches the server would undo what was just written.
 */
let writePending = false;

export const isWritePending = (): boolean => writePending;


/** FNV-1a: fast and good enough to tell whether the text changed. */
export const hashText = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * Splits the file header (blank lines and leading comments) off from the rest. The backend
 * knows nothing about comments, so without this a save would lose the header block that many
 * users put at the top of their todo.txt.
 */
export const splitPreamble = (text: string): { preamble: string[]; body: string } => {
  const allLines = text.split('\n');
  const preamble: string[] = [];
  let index = 0;
  while (index < allLines.length) {
    const line = allLines[index].trim();
    if (line === '' || line.startsWith('#')) {
      preamble.push(allLines[index]);
      index++;
      continue;
    }
    break;
  }
  return { preamble, body: allLines.slice(index).join('\n') };
};

export type DocStatus = 'idle' | 'syncing' | 'linked' | 'in-memory' | 'error';

interface Snapshot {
  lines: string[];
  preamble: string[];
  uidByLine: (string | null)[];
}

interface TodoDocState {
  /** Informational only: who owns the file right now. */
  source: 'servidor' | 'disco' | null;
  lines: string[];
  preamble: string[];
  uidByLine: (string | null)[];
  status: DocStatus;
  message: string | null;
  lastDiskHash: number;
  cursor: number;
  selected: number[];
  history: Snapshot[];

  link: (reconciledFile: string, source: 'servidor' | 'disco') => void;
  unlink: () => void;
  /** Applies a line patch. `next` receives the current state and returns the lines. */
  patch: (next: (state: TodoDocState) => Pick<Snapshot, 'lines' | 'preamble' | 'uidByLine'>) => void;
  setCursor: (index: number) => void;
  toggleSelected: (index: number) => void;
  clearSelection: () => void;
  undo: () => void;
  applyExternalFile: (content: string, diskHash: number, diskPreamble?: string[]) => void;
  /** Replaces the document with the reconciled version the server returns. */
  applyReconciled: (content: string) => void;
  serialize: () => string;
  setStatus: (status: DocStatus, message?: string | null) => void;
}

const snapshot = (state: TodoDocState): Snapshot => ({
  lines: state.lines,
  preamble: state.preamble,
  uidByLine: state.uidByLine,
});

const toLines = (file: string): { lines: string[]; uidByLine: (string | null)[] } => {
  const lines = file.split('\n').filter((line) => line.trim() !== '');
  return { lines, uidByLine: lines.map((line) => parseTodoLine(line).uid) };
};

export const useTodoDoc = create<TodoDocState>((set, get) => ({
  source: null,
  lines: [],
  preamble: [],
  uidByLine: [],
  status: 'idle',
  message: null,
  lastDiskHash: 0,
  cursor: 0,
  selected: [],
  history: [],

  link: (reconciledFile, source) => {
    const { lines, uidByLine } = toLines(reconciledFile);
    const { preamble } = splitPreamble(reconciledFile);
    set({
      source,
      lines,
      uidByLine,
      preamble,
      // The hash is of the REAL on-disk content, not of the reconciled one: compared against
      // the second, the poll would always see a difference and reimport in a loop.
      lastDiskHash: hashText(reconciledFile),
      status: 'linked',
      message: 'Sincronizado con el archivo del servidor',
      history: [],
      cursor: 0,
      selected: [],
    });
  },

  unlink: () =>
    set({ source: null, status: 'idle', message: null, history: [], selected: [], cursor: 0 }),

  patch: (next) => {
    // The latch is armed here, not at commit time: between the patch and the commit there is
    // a network await, and the poll slipping in there would reread the old file and undo the
    // patch.
    writePending = true;
    const state = get();
    const before = snapshot(state);
    const partial = next(state);
    const history = [...state.history, before].slice(-UNDO_DEPTH);
    set({
      ...partial,
      history,
      // A patch invalidates the disk preview: the next write changes the hash.
      lastDiskHash: -1,
    });
  },

  setCursor: (index) =>
    set((state) => ({ cursor: Math.max(0, Math.min(index, state.lines.length - 1)) })),

  toggleSelected: (index) =>
    set((state) => ({
      selected: state.selected.includes(index)
        ? state.selected.filter((i) => i !== index)
        : [...state.selected, index].sort((a, b) => a - b),
    })),

  clearSelection: () => set({ selected: [] }),

  undo: () =>
    set((state) => {
      if (!state.history.length) return state;
      const previous = state.history[state.history.length - 1];
      return { ...previous, history: state.history.slice(0, -1), lastDiskHash: -1 };
    }),

  /**
   * Reloads after an external change. The history is dropped on purpose: if another process
   * rewrote the file, undoing back to "before" would no longer mean anything.
   *
   * @param diskHash hash of the text read from disk, which may differ from the reconciled one.
   * @param diskPreamble header as it is on disk, which the backend does not preserve.
   */
  applyExternalFile: (content, diskHash, diskPreamble = splitPreamble(content).preamble) => {
    const { lines, uidByLine } = toLines(content);
    set({
      lines,
      uidByLine,
      preamble: diskPreamble,
      lastDiskHash: diskHash,
      history: [],
      cursor: 0,
      selected: [],
      status: 'linked',
      message: 'El archivo cambió fuera: recargado',
    });
  },

  applyReconciled: (content) => {
    const { lines, uidByLine } = toLines(content);
    set({ lines, uidByLine, lastDiskHash: hashText(content) });
  },

  serialize: () => {
    const { lines, preamble } = get();
    const body = [...preamble, ...lines].join('\n');
    // Without a trailing newline the next line would be glued to the previous one.
    return body === '' ? '' : `${body}\n`;
  },

  setStatus: (status, message = null) => set({ status, message }),
}));

// --- Line mutations ------------------------------------------------------------------------

export const todoDocMutations = {
  toggleComplete(index: number, todayIso: string): string | null {
    const state = useTodoDoc.getState();
    const raw = state.lines[index];
    if (raw === undefined) return null;
    const line = parseTodoLine(raw);
    const uid = state.uidByLine[index];
    const nextDone = !line.done;

    state.patch((current) => {
      const lines = [...current.lines];
      const uids = [...current.uidByLine];
      const updated = formatTodoLine({
        ...line,
        done: nextDone,
        completed: nextDone ? todayIso : null,
      });

      if (nextDone && line.recurrence && line.due) {
        const advanced = advanceIsoDate(line.due, line.recurrence);
        if (advanced) {
          // The next instance lands right below, the way tuxedo does on completion.
          const spawned = formatTodoLine({ ...line, done: false, created: todayIso, due: advanced });
          lines.splice(index, 1, updated, spawned);
          uids.splice(index, 1, uid, uid);
        } else {
          lines[index] = updated;
        }
      } else {
        lines[index] = updated;
      }
      return { lines, preamble: current.preamble, uidByLine: uids };
    });
    return uid;
  },

  removeLine(index: number): string | null {
    const state = useTodoDoc.getState();
    const uid = state.uidByLine[index];
    if (uid === undefined) return null;
    state.patch((current) => ({
      lines: current.lines.filter((_, i) => i !== index),
      preamble: current.preamble,
      uidByLine: current.uidByLine.filter((_, i) => i !== index),
    }));
    return uid;
  },

  cyclePriority(index: number): { uid: string | null; priority: string | null } {
    const state = useTodoDoc.getState();
    const raw = state.lines[index];
    const uid = state.uidByLine[index];
    if (raw === undefined) return { uid, priority: null };
    const line = parseTodoLine(raw);
    // The tuxedo cycle is A -> B -> C -> none.
    const next =
      line.priority === 'A' ? 'B' : line.priority === 'B' ? 'C' : line.priority === 'C' ? null : 'A';

    state.patch((current) => {
      const lines = [...current.lines];
      lines[index] = formatTodoLine({ ...line, priority: next });
      return { lines, preamble: current.preamble, uidByLine: current.uidByLine };
    });
    return { uid, priority: next };
  },

  /** Writes or removes a line's `rec:` token. null leaves it without recurrence. */
  setRecurrence(index: number, recurrence: string | null): string | null {
    const state = useTodoDoc.getState();
    const raw = state.lines[index];
    if (raw === undefined) return null;
    const uid = state.uidByLine[index];
    const line = parseTodoLine(raw);

    state.patch((current) => {
      const lines = [...current.lines];
      lines[index] = formatTodoLine({ ...line, recurrence });
      return { lines, preamble: current.preamble, uidByLine: current.uidByLine };
    });
    return uid;
  },

  move(index: number, delta: number): string | null {
    const state = useTodoDoc.getState();
    const target = index + delta;
    if (index < 0 || index >= state.lines.length || target < 0 || target >= state.lines.length) {
      return null;
    }
    const uid = state.uidByLine[index];
    state.patch((current) => {
      const lines = [...current.lines];
      const uids = [...current.uidByLine];
      [lines[index], lines[target]] = [lines[target], lines[index]];
      [uids[index], uids[target]] = [uids[target], uids[index]];
      return { lines, preamble: current.preamble, uidByLine: uids };
    });
    return uid;
  },
};

/** Releases the latch once the write has reached the server. */
export const markPendingWrite = (): void => {
  writePending = true;
};

export const clearPendingWrite = (): void => {
  writePending = false;
};
