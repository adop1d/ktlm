import { describe, expect, it } from 'vitest';
import { MemoryTodoFileHandle } from '../FileHandlePort';

describe('MemoryTodoFileHandle', () => {
  it('devuelve null para un hermano que no existe', async () => {
    const todo = new MemoryTodoFileHandle('todo.txt');

    expect(await todo.sibling('inbox.txt')).toBeNull();
  });

  it('devuelve el hermano sembrado', async () => {
    const todo = new MemoryTodoFileHandle('todo.txt');
    const inbox = todo.seed('inbox.txt', 'Tarea pendiente\n');

    const found = await todo.sibling('inbox.txt');

    expect(found).toBe(inbox);
    expect(await found?.read()).toBe('Tarea pendiente\n');
  });

  it('escribir en el hermano no toca el todo.txt', async () => {
    const todo = new MemoryTodoFileHandle('todo.txt', 'Original\n');
    const inbox = todo.seed('inbox.txt', 'Entrante\n');

    await inbox.write('');

    expect(await todo.read()).toBe('Original\n');
    expect(await inbox.read()).toBe('');
  });

  it('el hermano escribe es el mismo objeto, no una copia', async () => {
    const todo = new MemoryTodoFileHandle('todo.txt');
    const inbox = todo.seed('inbox.txt', '');

    await inbox.write('nueva linea');
    const again = await todo.sibling('inbox.txt');

    expect(await again?.read()).toBe('nueva linea');
  });
});