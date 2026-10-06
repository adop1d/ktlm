import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryTodoFileHandle } from '../FileHandlePort';
import { hashText, todoDocMutations, useTodoDoc } from '../todoDoc';
import { advanceIsoDate, parseTodoLine } from '../todoLine';

const SAMPLE = [
  '(A) 2026-04-28 Call dentist +health @phone due:2026-05-08 uid:1',
  '2026-05-09 Pay rent due:2026-05-15 rec:+1m uid:2',
  'Buy milk uid:3',
].join('\n');

const reset = () => {
  useTodoDoc.setState({
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
  });
};

describe('todoLine', () => {
  it('separa los campos que necesita un parche de línea', () => {
    const line = parseTodoLine('(A) 2026-04-28 Call dentist +health @phone due:2026-05-08 uid:1');
    expect(line.priority).toBe('A');
    expect(line.created).toBe('2026-04-28');
    expect(line.due).toBe('2026-05-08');
    expect(line.uid).toBe('1');
    expect(line.done).toBe(false);
  });

  it('reconoce una tarea completada con su fecha, sin mezclarla con la de creación', () => {
    const line = parseTodoLine('x 2026-10-05 2026-04-28 Call dentist uid:1');
    expect(line.done).toBe(true);
    expect(line.completed).toBe('2026-10-05');
    expect(line.created).toBe('2026-04-28');
  });

  it('no confunde una palabra suelta con una fecha', () => {
    const line = parseTodoLine('2026 no es fecha');
    expect(line.created).toBeNull();
    expect(line.body).toBe('2026 no es fecha');
  });

  it('avanza fechas según el token de recurrencia', () => {
    expect(advanceIsoDate('2026-05-15', '+1m')).toBe('2026-06-15');
    expect(advanceIsoDate('2026-05-15', '+1w')).toBe('2026-05-22');
    expect(advanceIsoDate('2026-05-15', '-3d')).toBe('2026-05-12');
    expect(advanceIsoDate('2026-02-28', '+1y')).toBe('2027-02-28');
  });

  it('salta fines de semana en días hábiles', () => {
    // 2026-05-15 es viernes: +1b debe caer en lunes, no en sábado.
    expect(advanceIsoDate('2026-05-15', '+1b')).toBe('2026-05-18');
  });

  it('devuelve null ante una recurrencia que no entiende', () => {
    expect(advanceIsoDate('2026-05-15', 'nonsense')).toBeNull();
  });
});

describe('todoDoc', () => {
  beforeEach(() => {
    reset();
    useTodoDoc.getState().link(new MemoryTodoFileHandle('todo.txt', SAMPLE), SAMPLE, SAMPLE);
  });

  it('conserva el encabezado de comentarios al vincular', () => {
    reset();
    const file = '# Mis tareas\n\n(A) 2026-04-28 Call dentist uid:1\n';
    useTodoDoc.getState().link(new MemoryTodoFileHandle('todo.txt', file), file, file);
    expect(useTodoDoc.getState().serialize()).toContain('# Mis tareas');
  });

  it('al completar una tarea recurrente inserta la siguiente debajo', () => {
    const uid = todoDocMutations.toggleComplete(1, '2026-10-05');
    const { lines } = useTodoDoc.getState();

    expect(uid).toBe('2');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toMatch(/^x 2026-10-05 /);
    expect(lines[2]).toContain('rec:+1m');
    expect(lines[2]).toContain('due:2026-06-15');
    expect(lines[2]).not.toMatch(/^x /);
  });

  it('al completar sin recurrencia solo marca la línea', () => {
    todoDocMutations.toggleComplete(0, '2026-10-05');
    expect(useTodoDoc.getState().lines).toHaveLength(3);
    expect(useTodoDoc.getState().lines[0]).toMatch(/^x 2026-10-05 /);
  });

  it('cicla la prioridad A -> B -> C -> ninguna como tuxedo', () => {
    expect(todoDocMutations.cyclePriority(0).priority).toBe('B');
    expect(todoDocMutations.cyclePriority(0).priority).toBe('C');
    expect(todoDocMutations.cyclePriority(0).priority).toBeNull();
    expect(todoDocMutations.cyclePriority(0).priority).toBe('A');
  });

  it('borra la línea correcta y su uid', () => {
    expect(todoDocMutations.removeLine(0)).toBe('1');
    const { lines, uidByLine } = useTodoDoc.getState();
    expect(lines).toHaveLength(2);
    expect(uidByLine).toEqual(['2', '3']);
  });

  it('mueve una línea conservando su uid', () => {
    todoDocMutations.move(0, 1);
    expect(useTodoDoc.getState().uidByLine).toEqual(['2', '1', '3']);
    expect(useTodoDoc.getState().lines[0]).toContain('Pay rent');
  });

  it('deshace hasta 50 pasos y no más', () => {
    for (let i = 0; i < 60; i++) todoDocMutations.cyclePriority(2);
    expect(useTodoDoc.getState().history).toHaveLength(50);

    useTodoDoc.getState().undo();
    expect(useTodoDoc.getState().history).toHaveLength(49);
  });

  it('descarta el historial cuando el archivo cambia por fuera', () => {
    todoDocMutations.removeLine(0);
    expect(useTodoDoc.getState().history.length).toBeGreaterThan(0);

    const content = 'Buy milk uid:9\nOtra cosa uid:10\n';
    useTodoDoc.getState().applyExternalFile(content, hashText(content));

    expect(useTodoDoc.getState().history).toHaveLength(0);
    expect(useTodoDoc.getState().uidByLine).toEqual(['9', '10']);
  });

  it('mantiene la cabecera que viene del disco al recargar', () => {
    const content = 'Compra pan uid:9\n';
    useTodoDoc.getState().applyExternalFile(content, hashText(content), ['# cabecera', '']);
    expect(useTodoDoc.getState().serialize()).toContain('# cabecera');
  });

  it('marca la vista previa como inválida tras un parche', () => {
    useTodoDoc.getState().link(new MemoryTodoFileHandle('t', SAMPLE), SAMPLE, SAMPLE);
    expect(useTodoDoc.getState().lastDiskHash).not.toBe(-1);
    todoDocMutations.removeLine(0);
    expect(useTodoDoc.getState().lastDiskHash).toBe(-1);
  });
});