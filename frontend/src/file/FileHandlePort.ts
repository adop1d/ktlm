/**
 * Leer un todo.txt del disco para importarlo.
 *
 * Antes esto era el archivo de trabajo: el navegador elegía una carpeta y todo lo que se
 * editaba iba a disco desde aquí. Ya no. El archivo lo lleva el servidor y la File System
 * Access API sobrevive únicamente como forma de traerte una lista que tengas en el disco.
 *
 * Es de Chromium. Fuera de ahí, importar no está disponible y la interfaz lo dice en vez de
 * fingir.
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

/** Abre un todo.txt del disco y lo devuelve entero. null si se cancela. */
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