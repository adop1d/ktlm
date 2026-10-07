/**
 * Connects the app to the todo.txt.
 *
 * The server owns the file, so there is no polling here: the server signals changes over SSE
 * and writes go over HTTP. The File System Access API survives only as a way to import a
 * file you already have on disk.
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
   * The file no longer lives in this browser: the server holds it. Linking is just asking for
   * it; the server creates it if it did not exist.
   */
  const openAndLink = useCallback(async () => {
    const file: string = await api.readTodoFile();
    useTodoDoc.getState().link(file, 'servidor');
    addToast('success', `Vinculado: ${file.split('\n').filter(Boolean).length} tareas`);
    refresh();
  }, [addToast, refresh]);

  /**
   * Import from disk. This is the only remaining use of the File System Access API: it is no
   * longer where the file comes from, just a way to bring it in once.
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

  /** The table order follows the file, so it is pushed after every patch. */
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
      // The order is cosmetic; the file content is still what matters.
    }
    // The server reconciles and returns the file with the uid values already in place: that is
    // what should be shown. Echoing back what the client sent would put the old uid back in.
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

  /** The tuxedo letters are not the values of the backend enum. */
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
   * Undo puts lines back in the file, but the rows deleted from the database do not come back
   * on their own: the document has to be reimported to reconcile.
   */
  const undo = useCallback(async () => {
    useTodoDoc.getState().undo();
    await api.importTodoFile(useTodoDoc.getState().serialize());
    await commit();
  }, [commit]);

  /**
   * Completed tasks go to `done.txt`, the sibling file where tuxedo puts them too. The server
   * returns the content; here it is written to the real file, which is what makes `tuxedo lsa`
   * see them in the same place.
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
   * The done file lives on disk, not in the database: completed tasks are archived and leave
   * the list. That is why the file view is built by reading the sibling.
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