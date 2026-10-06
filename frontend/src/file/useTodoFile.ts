/**
 * Une la app con el todo.txt del disco: lo abre, lo reconcilia con el servidor y vigila que
 * nada lo cambie por fuera sin avisar.
 *
 * El ciclo sigue el de tuxedo: comparar el contenido contra lo último visto, y cuando no
 * coincide, gana el archivo y se recarga.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../api/tasks';
import { useToastStore } from '../stores/toastStore';
import type { TaskPriority } from '../types/task';
import type { TodoFileHandle } from './FileHandlePort';
import {
  isFileSystemAccessSupported,
  pickTodoFile,
  saveTodoFileAs,
} from './FileHandlePort';
import {
  POLL_INTERVAL_MS,
  flushNow,
  hashText,
  isWritePending,
  scheduleFlush,
  splitPreamble,
  todoDocMutations,
  useTodoDoc,
} from './todoDoc';

/** El nombre del hermano donde cualquier cosa puede dejar una línea para que la recojamos. */
const INBOX_NAME = 'inbox.txt';
const DONE_NAME = 'done.txt';

/** Vacía un archivo hermano: el drenaje no reintenta, igual que el rename de tuxedo. */
const EMPTY = '';

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
};

export const useTodoFile = () => {
  const qc = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const pollRef = useRef(0);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    void qc.invalidateQueries({ queryKey: ['task-counts'] });
  }, [qc]);

  /** Relee el disco. Si cambió por fuera, el archivo gana y se recarga todo. */
  const reconcile = useCallback(async () => {
    const { handle, lastDiskHash, setStatus } = useTodoDoc.getState();
    if (!handle) return;

    // Con una escritura en curso el disco va por detrás: leerlo ahora y reimportar
    // desharía el parche que todavía no ha llegado al archivo.
    if (isWritePending()) return;

    let content: string;
    try {
      content = await handle.read();
    } catch {
      // Nunca se escribe a ciegas sobre un archivo que no se ha podido leer.
      setStatus('error', 'No se pudo leer el archivo: escrituras congeladas');
      return;
    }

    // El inbox se drena siempre, incluso si el todo.txt no ha cambiado: su único proposito
    // es que alguien escriba ahi sin abrir la app.
    await drainInbox(handle);

    if (hashText(content) === lastDiskHash) return;

    const result = await api.importTodoFile(content);
    // El hash a recordar es el del texto leído, no el del reconciliado: si no, el poll vería
    // una diferencia en cada vuelta y volvería a importar sin parar. Y el preámbulo se toma
    // del disco, no del reconciliado: el backend no conoce los comentarios y se los tragaría.
    useTodoDoc
      .getState()
      .applyExternalFile(result.file, hashText(content), splitPreamble(content).preamble);
    addToast('info', 'El todo.txt cambió fuera y se recargó');
    refresh();
  }, [addToast, refresh]);

  /**
   * Recoge lo que haya en inbox.txt y lovacía. Cualquier cosa que sepa escribir una línea
   * ahí sirve de productor: un `echo`, un atajo de iOS, un cron.
   */
  const drainInbox = useCallback(
    async (handle: TodoFileHandle) => {
      const inbox = await handle.sibling(INBOX_NAME);
      if (!inbox) return;

      let body: string;
      try {
        body = await inbox.read();
      } catch {
        return;
      }
      // Vaciarlo ANTES de importar es lo que evita el bucle: si fallara la importación,
      // las líneas ya no están en el inbox y se pierden, pero no se reprocesan para siempre.
      if (!body.trim()) return;
      await inbox.write(EMPTY);

      await api.importTodoFile(body);
      addToast('success', 'Tareas recibidas por inbox.txt');
      refresh();
    },
    [addToast, refresh]
  );

  const openAndLink = useCallback(async () => {
    const opened = await pickTodoFile();
    if (!opened) return;
    const result = await api.importTodoFile(opened.content);
    useTodoDoc.getState().link(opened.handle, result.file, opened.content);
    addToast('success', `Vinculado ${opened.handle.name}: ${result.parsed} tareas`);
    // Hay que volcar el archivo reconciliado: es lo que lleva los uid al disco, y sin ellos
    // la próxima importación no reconocería las tareas y las duplicaría.
    scheduleFlush();
    refresh();
  }, [addToast, refresh]);

  /** Guarda el estado actual en un todo.txt nuevo. */
  const saveAs = useCallback(async () => {
    const content = useTodoDoc.getState().serialize();
    const handle = await saveTodoFileAs(content);
    if (!handle) return;
    useTodoDoc.getState().link(handle, content, content);
    addToast('success', `Guardado como ${handle.name}`);
  }, [addToast]);

  const detach = useCallback(() => {
    flushNow().finally(() => useTodoDoc.getState().unlink());
  }, []);

  useEffect(() => {
    pollRef.current = window.setInterval(() => {
      void reconcile();
    }, POLL_INTERVAL_MS);
    return () => {
      window.clearInterval(pollRef.current);
      pollRef.current = 0;
    };
  }, [reconcile]);

  /** El orden de la tabla lo sigue el archivo, así que se propaga tras cada parche. */
  const pushLineOrder = async (): Promise<void> => {
    const { uidByLine } = useTodoDoc.getState();
    await Promise.all(
      uidByLine.map((uid, index) =>
        uid ? api.updateTask(Number(uid), { sortOrder: index }) : Promise.resolve()
      )
    );
  };

  const commit = useCallback(async () => {
    try {
      await pushLineOrder();
    } catch {
      // El orden es cosmético; el contenido del archivo sigue siendo lo importante.
    }
    scheduleFlush();
    refresh();
  }, [refresh]);

  const toggleComplete = useCallback(
    async (index: number) => {
      const uid = todoDocMutations.toggleComplete(index, todayIso());
      if (uid === null) return;
      await api.toggleTask(Number(uid)).catch(() => null);
      await commit();
    },
    [commit]
  );

  const remove = useCallback(
    async (index: number) => {
      const uid = todoDocMutations.removeLine(index);
      if (uid === null) return;
      await api.deleteTask(Number(uid)).catch(() => null);
      await commit();
    },
    [commit]
  );

  /** Las letras de tuxedo no son los valores del enum del backend. */
  const PRIORITY_BY_LETTER: Record<string, TaskPriority> = { A: 'HIGH', B: 'MEDIUM', C: 'LOW' };

  const cyclePriority = useCallback(
    async (index: number) => {
      const { uid, priority } = todoDocMutations.cyclePriority(index);
      if (uid === null || priority === null) return;
      const mapped = PRIORITY_BY_LETTER[priority];
      if (mapped) {
        await api.updateTask(Number(uid), { priority: mapped }).catch(() => null);
      }
      await commit();
    },
    [commit]
  );

  const setRecurrence = useCallback(
    async (index: number, recurrence: string | null) => {
      const uid = todoDocMutations.setRecurrence(index, recurrence);
      if (uid === null) return;
      await api.updateTask(Number(uid), { recurrence }).catch(() => null);
      await commit();
    },
    [commit]
  );

  const move = useCallback(
    async (index: number, delta: number) => {
      const uid = todoDocMutations.move(index, delta);
      if (uid === null) return;
      await commit();
      return uid;
    },
    [commit]
  );

  /**
   * Deshacer devuelve líneas al archivo, pero las filas que se borraron de la base no
   * vuelven solas: hay que reimportar el documento para reconciliar.
   */
  const undo = useCallback(async () => {
    useTodoDoc.getState().undo();
    await api.importTodoFile(useTodoDoc.getState().serialize());
    await commit();
  }, [commit]);

  /**
   * Las completadas se van a `done.txt`, el archivo hermano donde las deja tuxedo también.
   * El servidor devuelve el contenido; aquí se escribe en el archivo de verdad, que es lo
   * que hace que `tuxedo lsa` las vea en el mismo sitio.
   */
  const archive = useCallback(async () => {
    const result = await api.archiveCompleted();
    if (result.archived > 0) {
      const { handle } = useTodoDoc.getState();
      const done = handle ? await handle.sibling(DONE_NAME) : null;
      if (done) {
        const previous = await done.read().catch(() => '');
        await done.write(`${previous}${result.doneFile}`);
      }
      addToast('success', `${result.archived} tareas a done.txt`);
      await commit();
    } else {
      addToast('info', 'No hay completadas que archivar');
    }
    return result;
  }, [addToast, commit]);

  /**
   * El archivo de hechas vive en el disco, no en la base: las completadas se archivan y
   * salen de la lista. Por eso la vista de archivo se arma leyendo el hermano.
   */
  const readArchive = useCallback(async (): Promise<string[]> => {
    const { handle } = useTodoDoc.getState();
    const done = handle ? await handle.sibling(DONE_NAME) : null;
    if (!done) return [];
    const body = await done.read().catch(() => '');
    return body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
  }, []);

  return {
    openAndLink,
    saveAs,
    detach,
    toggleComplete,
    remove,
    cyclePriority,
    setRecurrence,
    move,
    undo,
    archive,
    readArchive,
    reconcile,
    isPersistent: isFileSystemAccessSupported(),
  };
};