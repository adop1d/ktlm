package ktm.model;

/** State filter for the paginated list. */
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

    /** Tolerant value: any unknown input falls back to ALL instead of failing the request. */
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