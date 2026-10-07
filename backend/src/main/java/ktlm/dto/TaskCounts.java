package ktlm.dto;

/** Contadores para las pestañas de filtro. Con paginación no se pueden calcular en cliente. */
public record TaskCounts(long all, long active, long completed) {}