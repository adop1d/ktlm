import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/tasks';
import { Task } from '../types/task';

export const useTasks = () => {
  const qc = useQueryClient();

  const { data: tasks, isLoading, error } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: api.getTasks,
  });

  const createMut = useMutation({
    mutationFn: api.createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Task> }) => api.updateTask(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const deleteMut = useMutation({
    mutationFn: api.deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const toggleMut = useMutation({
    mutationFn: api.toggleTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  return {
    tasks,
    isLoading,
    error,
    createTask: createMut.mutate,
    updateTask: (id: number, payload: Partial<Task>) => updateMut.mutate({ id, payload }),
    deleteTask: deleteMut.mutate,
    toggleTask: toggleMut.mutate,
  };
};
