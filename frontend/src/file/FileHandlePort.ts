/**
 * Read a todo.txt from disk to import it.
 *
 * This used to be the working file: the browser picked a folder and everything edited went to
 * disk from here. Not anymore. The server holds the file, and the File System Access API
 * survives only as a way to bring in a list you already have on disk.
 *
 * It is Chromium-only. Anywhere else importing is unavailable, and the interface says so
 * instead of pretending.
 */

interface FsaFileHandleLike {
  readonly name: string;
  getFile(): Promise<{ text(): Promise<string> }>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: unknown) => Promise<FsaFileHandleLike[]>;
  }
}

export const isFileSystemAccessSupported = (): boolean =>
  typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

export interface PickedFile {
  name: string;
  content: string;
}

/** Opens a todo.txt from disk and returns it whole. null if cancelled. */
export const pickTodoFile = async (): Promise<PickedFile | null> => {
  if (!isFileSystemAccessSupported()) {
    return null;
  }
  const [handle] = await window.showOpenFilePicker!({
    multiple: false,
    types: [{ description: 'todo.txt', accept: { 'text/plain': ['.txt'] } }],
  });
  if (!handle) return null;
  return { name: handle.name, content: await (await handle.getFile()).text() };
};