/**
 * Acceso a un todo.txt del disco.
 *
 * La implementación real usa la File System Access API, que solo existe en Chromium. En
 * cualquier otro navegador, o en los tests, cae a una implementación en memoria: la app
 * sigue funcionando contra la API, pero el archivo no se sincroniza y la UI lo avisa.
 */

export interface TodoFileHandle {
  readonly name: string;
  /** false cuando los cambios no llegan al disco. La UI lo muestra. */
  readonly persistent: boolean;
  read(): Promise<string>;
  /**
   * Escribe el contenido completo. En Chromium, createWritable() deja un temporal y lo
   * renombra al cerrar, así que un fallo a mitad no deja el archivo truncado.
   */
  write(content: string): Promise<void>;
}

interface FsaWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

interface FsaFileHandleLike {
  readonly name: string;
  queryPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission?(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  getFile(): Promise<{ text(): Promise<string> }>;
  createWritable(): Promise<FsaWritable>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: unknown) => Promise<FsaFileHandleLike[]>;
    showSaveFilePicker?: (options?: unknown) => Promise<FsaFileHandleLike>;
  }
}

export const isFileSystemAccessSupported = (): boolean =>
  typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';

export class FsaTodoFileHandle implements TodoFileHandle {
  readonly persistent = true;

  constructor(private readonly handle: FsaFileHandleLike) {}

  get name(): string {
    return this.handle.name;
  }

  async read(): Promise<string> {
    const state = await this.ensurePermission();
    if (state !== 'granted') {
      throw new Error('Permiso de lectura denegado para el archivo');
    }
    return (await this.handle.getFile()).text();
  }

  async write(content: string): Promise<void> {
    const state = await this.ensurePermission();
    if (state !== 'granted') {
      throw new Error('Permiso de escritura denegado para el archivo');
    }
    const writable = await this.handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  private async ensurePermission(): Promise<PermissionState> {
    if (!this.handle.queryPermission) return 'granted';
    const current = await this.handle.queryPermission({ mode: 'readwrite' });
    if (current === 'granted') return current;
    return this.handle.requestPermission?.({ mode: 'readwrite' }) ?? 'denied';
  }
}

/** Fallback para Firefox, Safari y los tests: el contenido vive solo en memoria. */
export class MemoryTodoFileHandle implements TodoFileHandle {
  readonly persistent = false;
  readonly name: string;

  private content: string;

  constructor(name: string, initial = '') {
    this.name = name;
    this.content = initial;
  }

  async read(): Promise<string> {
    return this.content;
  }

  async write(content: string): Promise<void> {
    this.content = content;
  }
}

export interface OpenedTodoFile {
  handle: TodoFileHandle;
  /** El archivo ya leído; evita una segunda pasada por el mismo contenido. */
  content: string;
}

/** Abre el todo.txt. Devuelve null si el usuario cancela el diálogo. */
export const pickTodoFile = async (): Promise<OpenedTodoFile | null> => {
  if (!isFileSystemAccessSupported()) {
    return { handle: new MemoryTodoFileHandle('todo.txt'), content: '' };
  }
  const [handle] = await window.showOpenFilePicker!({
    multiple: false,
    types: [{ description: 'todo.txt', accept: { 'text/plain': ['.txt'] } }],
  });
  if (!handle) return null;
  const wrapped = new FsaTodoFileHandle(handle);
  return { handle: wrapped, content: await wrapped.read() };
};

/** Guarda como un todo.txt nuevo, para cuando todavía no hay archivo vinculado. */
export const saveTodoFileAs = async (content: string): Promise<TodoFileHandle | null> => {
  if (!isFileSystemAccessSupported() || typeof window.showSaveFilePicker !== 'function') {
    return new MemoryTodoFileHandle('todo.txt', content);
  }
  const handle = await window.showSaveFilePicker({
    suggestedName: 'todo.txt',
    types: [{ description: 'todo.txt', accept: { 'text/plain': ['.txt'] } }],
  });
  const wrapped = new FsaTodoFileHandle(handle);
  await wrapped.write(content);
  return wrapped;
};