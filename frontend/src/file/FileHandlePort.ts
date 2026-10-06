/**
 * Acceso a un todo.txt del disco y a su inbox.txt hermano.
 *
 * La File System Access API entrega un handle de archivo sin decir dónde está, así que para
 * llegar al hermano hay que pedir el **directorio**: es el directorio el que sabe resolver
 * nombres dentro de él. Por eso el selector elige una carpeta y no un archivo.
 *
 * Fuera de Chromium, o en los tests, cae a una implementación en memoria: la app sigue
 * funcionando contra la API, pero el archivo no se sincroniza y la UI lo avisa.
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
  /** Otro archivo de la misma carpeta, o null si no existe. */
  sibling(name: string): Promise<TodoFileHandle | null>;
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

interface FsaDirectoryHandleLike {
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FsaFileHandleLike>;
}

declare global {
  interface Window {
    showOpenFilePicker?: (options?: unknown) => Promise<FsaFileHandleLike[]>;
    showSaveFilePicker?: (options?: unknown) => Promise<FsaFileHandleLike>;
    showDirectoryPicker?: (options?: unknown) => Promise<FsaDirectoryHandleLike>;
  }
}

export const isFileSystemAccessSupported = (): boolean =>
  typeof window !== 'undefined' &&
  (typeof window.showDirectoryPicker === 'function' ||
    typeof window.showOpenFilePicker === 'function');

class FsaFileHandle implements TodoFileHandle {
  readonly persistent = true;

  constructor(
    private readonly handle: FsaFileHandleLike,
    private readonly directory: FsaDirectoryHandleLike
  ) {}

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

  async sibling(name: string): Promise<TodoFileHandle | null> {
    try {
      // create: false — el inbox solo existe si alguien escribe en él.
      const handle = await this.directory.getFileHandle(name, { create: false });
      return new FsaFileHandle(handle, this.directory);
    } catch {
      return null;
    }
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
  private readonly siblings = new Map<string, MemoryTodoFileHandle>();

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

  async sibling(name: string): Promise<TodoFileHandle | null> {
    return this.siblings.get(name) ?? null;
  }

  /** Solo para los tests: siembra un archivo hermano. */
  seed(name: string, content: string): MemoryTodoFileHandle {
    const handle = new MemoryTodoFileHandle(name, content);
    this.siblings.set(name, handle);
    return handle;
  }
}

export interface OpenedTodoFile {
  handle: TodoFileHandle;
  /** El archivo ya leído; evita una segunda pasada por el mismo contenido. */
  content: string;
}

/**
 * Abre la carpeta que contiene el todo.txt. El archivo se crea si no está, igual que hace
 * tuxedo al resolver su ruta por defecto.
 */
export const pickTodoFile = async (): Promise<OpenedTodoFile | null> => {
  if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
    return { handle: new MemoryTodoFileHandle('todo.txt'), content: '' };
  }

  const directory = await window.showDirectoryPicker({ mode: 'readwrite' });
  const raw = await directory.getFileHandle('todo.txt', { create: true });
  const handle = new FsaFileHandle(raw, directory);
  return { handle, content: await handle.read() };
};

/** Guarda como un todo.txt nuevo, para cuando todavía no hay archivo vinculado. */
export const saveTodoFileAs = async (content: string): Promise<TodoFileHandle | null> => {
  if (typeof window === 'undefined' || typeof window.showSaveFilePicker !== 'function') {
    const handle = new MemoryTodoFileHandle('todo.txt', content);
    return handle;
  }
  const raw = await window.showSaveFilePicker({
    suggestedName: 'todo.txt',
    types: [{ description: 'todo.txt', accept: { 'text/plain': ['.txt'] } }],
  });
  // Sin directorio no hay hermano: el handle guardado no puede resolver inbox.txt.
  const handle = new FsaFileHandle(raw, {
    getFileHandle: async () => {
      throw new Error('sin directorio');
    },
  });
  await handle.write(content);
  return handle;
};