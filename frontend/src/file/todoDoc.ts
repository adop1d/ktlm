/**
 * Espejo en memoria del todo.txt del usuario.
 *
 * Invariante: `lines` ⇔ contenido del archivo ⇔ proyección en la base de datos.
 * Las mutaciones parchean líneas, no reserializan el archivo entero, y se agrupan en un
 * historial de undo como el de tuxedo. Cuando el archivo cambia por fuera, el espejo se
 * recarga y el historial se descarta: igual que hace tuxedo al detectar un cambio externo.
 */
import { create } from 'zustand';
import { TodoFileHandle } from './FileHandlePort';
import { advanceIsoDate, formatTodoLine, parseTodoLine } from './todoLine';

const UNDO_DEPTH = 50;
export const POLL_INTERVAL_MS = 400;
const FLUSH_DEBOUNCE_MS = 400;

/**
 * Cierre de escritura pendiente. El sondeo debe respetarlo: un parche local marca el hash
 * como inválido, y sin este cerrojo el siguiente tick leería el archivo viejo, lo tomaría
 * por un cambio externo y desharía lo que el usuario acababa de escribir.
 */
let writePending = false;

export const isWritePending = (): boolean => writePending;


/** FNV-1a: rápido y suficiente para detectar si el texto cambió. */
export const hashText = (text: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/**
 * Separa el encabezado del archivo (líneas en blanco y comentarios iniciales) del resto.
 * El backend no conoce los comentarios, así que sin esto un guardado perdería el bloque de
 * cabecera que muchos usuarios ponen en su todo.txt.
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
  handle: TodoFileHandle | null;
  lines: string[];
  preamble: string[];
  uidByLine: (string | null)[];
  status: DocStatus;
  message: string | null;
  lastDiskHash: number;
  cursor: number;
  selected: number[];
  history: Snapshot[];

  link: (handle: TodoFileHandle, reconciledFile: string, originalFile: string) => void;
  unlink: () => void;
  /** Aplica un parche de línea. `next` recibe el estado actual y devuelve las líneas. */
  patch: (next: (state: TodoDocState) => Pick<Snapshot, 'lines' | 'preamble' | 'uidByLine'>) => void;
  setCursor: (index: number) => void;
  toggleSelected: (index: number) => void;
  clearSelection: () => void;
  undo: () => void;
  applyExternalFile: (content: string, diskHash: number, diskPreamble?: string[]) => void;
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
  handle: null,
  lines: [],
  preamble: [],
  uidByLine: [],
  status: 'idle',
  message: null,
  lastDiskHash: 0,
  cursor: 0,
  selected: [],
  history: [],

  link: (handle, reconciledFile, originalFile) => {
    const { lines, uidByLine } = toLines(reconciledFile);
    const { preamble } = splitPreamble(originalFile);
    set({
      handle,
      lines,
      uidByLine,
      preamble,
      // El hash es del contenido REAL del disco, no del reconciliado: comparado con el
      // segundo, el poll vería siempre una diferencia y reimportaría en bucle.
      lastDiskHash: hashText(originalFile),
      status: handle.persistent ? 'linked' : 'in-memory',
      message: handle.persistent
        ? `Sincronizando con ${handle.name}`
        : 'Sin File System Access API: los cambios no llegan al disco',
      history: [],
      cursor: 0,
      selected: [],
    });
  },

  unlink: () =>
    set({ handle: null, status: 'idle', message: null, history: [], selected: [], cursor: 0 }),

  patch: (next) => {
    // El cerrojo se arma aquí y no en el commit: entre el parche y el commit hay un await
    // de red, y el sondeo colándose ahí releía el archivo viejo y deshacía el parche.
    writePending = true;
    const state = get();
    const before = snapshot(state);
    const partial = next(state);
    const history = [...state.history, before].slice(-UNDO_DEPTH);
    set({
      ...partial,
      history,
      // Un parche invalida la vista previa de disco: la siguiente escritura cambia el hash.
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
   * Recarga tras un cambio externo. El historial se descarta a propósito: si otro proceso
   * reescribió el archivo, deshacer hasta "antes" ya no significaría nada.
   *
   * @param diskHash hash del texto leído del disco, que puede diferir del reconciliado.
   * @param diskPreamble cabecera tal y como está en disco, que el backend no conserva.
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
      status: get().handle?.persistent ? 'linked' : 'in-memory',
      message: 'El archivo cambió fuera: recargado',
    });
  },

  serialize: () => {
    const { lines, preamble } = get();
    const body = [...preamble, ...lines].join('\n');
    // Sin salto final, la siguiente línea se pegaría a la anterior.
    return body === '' ? '' : `${body}\n`;
  },

  setStatus: (status, message = null) => set({ status, message }),
}));

// --- Mutaciones de línea ------------------------------------------------------------------

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
          // La instancia siguiente entra justo debajo, como hace tuxedo al completar.
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
    // El ciclo de tuxedo es A -> B -> C -> ninguna.
    const next =
      line.priority === 'A' ? 'B' : line.priority === 'B' ? 'C' : line.priority === 'C' ? null : 'A';

    state.patch((current) => {
      const lines = [...current.lines];
      lines[index] = formatTodoLine({ ...line, priority: next });
      return { lines, preamble: current.preamble, uidByLine: current.uidByLine };
    });
    return { uid, priority: next };
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

// --- Escritura al archivo -----------------------------------------------------------------

/** 0 como "sin temporizador": clearTimeout(0) no hace nada y evita arrastrar un null. */
let flushTimer = 0;

export const scheduleFlush = (): void => {
  writePending = true;
  window.clearTimeout(flushTimer);
  flushTimer = window.setTimeout(() => {
    flushTimer = 0;
    void flushNow();
  }, FLUSH_DEBOUNCE_MS);
};

export const flushNow = async (): Promise<void> => {
  const { handle, serialize } = useTodoDoc.getState();
  if (!handle) {
    writePending = false;
    return;
  }
  const content = serialize();
  useTodoDoc.getState().setStatus('syncing');
  try {
    await handle.write(content);
    useTodoDoc.setState({ lastDiskHash: hashText(content), message: null });
  } catch (error) {
    useTodoDoc.getState().setStatus('error', `No se pudo guardar: ${(error as Error).message}`);
  } finally {
    writePending = false;
  }
};