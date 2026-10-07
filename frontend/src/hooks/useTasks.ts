import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/tasks';
import { Task, TaskQueryParams } from '../types/task';

export const useTasks = (params: TaskQueryParams) => {
  const qc = useQueryClient();

  const pageQuery = useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.getTasks(params),
    placeholderData: keepPreviousData,
  });

  const countsQuery = useQuery({
    queryKey: ['task-counts'],
    queryFn: api.getTaskCounts,
  });

  // The prefix covers every page.
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['tasks'] });
    qc.invalidateQueries({ queryKey: ['task-counts'] });
  };

  const createMut = useMutation({ mutationFn: api.createTask, onSuccess: invalidate });
  const updateMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<Task> }) => api.updateTask(id, payload),
    onSuccess: invalidate,
  });
  const deleteMut = useMutation({ mutationFn: api.deleteTask, onSuccess: invalidate });
  const toggleMut = useMutation({ mutationFn: api.toggleTask, onSuccess: invalidate });

  return {
    page: pageQuery.data,
    counts: countsQuery.data,
    isLoading: pageQuery.isLoading,
    isFetching: pageQuery.isFetching,
    error: pageQuery.error,
    createTask: createMut.mutate,
    updateTask: (id: number, payload: Partial<Task>) => updateMut.mutate({ id, payload }),
    deleteTask: deleteMut.mutate,
    toggleTask: toggleMut.mutate,
  };
};