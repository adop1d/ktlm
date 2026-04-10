import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from '../TaskCard';
import { Task } from '../../types/task';
import { describe, test, expect, beforeEach, vi } from 'vitest';

const dummyTask: Task = {
  id: 1,
  title: 'Aprender Vitest',
  description: 'Escribir tests para la app',
  completed: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('TaskCard', () => {
  const onToggle = vi.fn();
  const onEdit = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders title and description', () => {
    render(
      <TaskCard
        task={dummyTask}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText(dummyTask.title)).toBeInTheDocument();
    expect(screen.getByText(dummyTask.description!)).toBeInTheDocument();
  });

  test('calls onToggle when completion icon clicked', () => {
    render(
      <TaskCard
        task={dummyTask}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByTitle('Marcar como completada'));
    expect(onToggle).toHaveBeenCalledWith(dummyTask.id);
  });

  test('calls onEdit and onDelete correctly', () => {
    render(
      <TaskCard
        task={dummyTask}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByTitle('Editar'));
    expect(onEdit).toHaveBeenCalledWith(dummyTask);
    fireEvent.click(screen.getByTitle('Eliminar'));
    expect(onDelete).toHaveBeenCalledWith(dummyTask.id);
  });
});
