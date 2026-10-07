package ktlm.model;

/** Filtro de estado para la lista paginada. */
public enum TaskFilter {
    ALL(null),
    ACTIVE(false),
    COMPLETED(true);

    private final Boolean completed;

    TaskFilter(Boolean completed) {
        this.completed = completed;
    }

    public Boolean completed() {
        return completed;
    }

    /** Valor tolerante: cualquier entrada desconocida cae en ALL en vez de fallar la petición. */
    public static TaskFilter from(String raw) {
        if (raw == null) {
            return ALL;
        }
        try {
            return valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return ALL;
        }
    }
}