/**
 * Une la app con el todo.txt.
 *
 * El archivo lo lleva el servidor, así que aquí no hay polling: el servidor avisa por SSE
 * cuando cambia y las escrituras van por HTTP. La File System Access API sobrevive solo
 * como forma de importar un archivo que ya tengas en el disco.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../api/tasks';
import { useToastStore } from '../stores/toastStore';
import type { TaskPriority } from '../types/task';
import { isFileSystemAccessSupported, pickTodoFile } from './FileHandlePort';
import {
  clearPendingWrite,
  markPendingWrite,
  todoDocMutations,
  useTodoDoc,
} from './todoDoc';

const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
};

export const useTodoFile = () => {
  const qc = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ['tasks'] });
    void qc.invalidateQueries({ queryKey: ['task-counts'] });
  }, [qc]);

  /**
   * El archivo ya no vive en este navegador: lo lleva el servidor. Vincular es pedirlo y ya
   * está; el servidor lo crea si no existía.
   */
  const openAndLink = useCallback(async () => {
    const file: string = await api.readTodoFile();
    useTodoDoc.getState().link(file, 'servidor');
    addToast('success', `Vinculado: ${file.split('\n').filter(Boolean).length} tareas`);
    refresh();
  }, [addToast, refresh]);

  /**
   * Importar desde el disco. Es la única vía que queda de la File System Access API: ya no
   * es de dónde viene el archivo, sino una forma de traértelo una vez.
   */
  const importFromDisk = useCallback(async () => {
    const opened = await pickTodoFile();
    if (!opened) return;
    if (!isFileSystemAccessSupported()) {
      addToast('error', 'Importar desde el disco necesita un navegador Chromium');
      return;
    }
    const result = await api.importTodoFile(opened.content);
    useTodoDoc.getState().link(result.file, 'servidor');
    addToast('success', `Importadas ${result.parsed} tareas desde tu disco`);
    refresh();
  }, [addToast, refresh]);

  const detach = useCallback(() => {
    useTodoDoc.getState().unlink();
  }, []);

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
    // El servidor reconcilia y devuelve el archivo ya con los uid puestos: eso es lo que hay
    // que mostrar. Devolver lo que envió el cliente sin más volvería a meter los uid viejos.
    const { serialize } = useTodoDoc.getState();
    markPendingWrite();
    try {
      await api.replaceTodoFile(serialize());
    } catch (error) {
      addToast('error', `No se pudo guardar: ${(error as Error).message}`);
    } finally {
      clearPendingWrite();
    }
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
    return api.readArchived().catch(() => []);
  }, []);

  return {
    openAndLink,
    detach,
    toggleComplete,
    remove,
    cyclePriority,
    setRecurrence,
    move,
    undo,
    archive,
    readArchive,
    importFromDisk,
    isPersistent: isFileSystemAccessSupported(),
  };
};