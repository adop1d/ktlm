import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api/tasks';
import { Task, TaskQueryParams } from '../types/task';

/**
 * Cada sesión conectada comparte la misma base de datos, así que la lista nunca está
 * obsoleta: lo que falta es que se note. Con estas dos opciones una sesión abierta en el
 * móvil recoge lo que se hizo en el escritorio —y al revés— sin recargar a mano.
 *
 * El archivo es otra cosa: ese solo se sincroniza desde el navegador en Chromium, que es lo
 * que permite la File System Access API. La base de datos no depende de eso.
 */
const SYNC_INTERVAL_MS = 10_000;

export const useTasks = (params: TaskQueryParams) => {
  const qc = useQueryClient();

  const pageQuery = useQuery({
    queryKey: ['tasks', params],
    queryFn: () => api.getTasks(params),
    placeholderData: keepPreviousData,
    refetchInterval: SYNC_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const countsQuery = useQuery({
    queryKey: ['task-counts'],
    queryFn: api.getTaskCounts,
    refetchInterval: SYNC_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  // El prefijo cubre todas las páginas.
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