package ktlm.model;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Root;

/**
 * Ordering mode for the paginated list. `file`, `priority` and `due` are tuxedo's three
 * cycles; the other three cover what the UI already offered.
 *
 * <p>The ordering is expressed over the criteria tree instead of with {@code Sort} because
 * priority needs a conditional expression that {@code Sort} cannot represent.
 */
public enum TaskSort {
    /** File order: sortOrder, which is the position in the todo.txt. */
    FILE {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            return cb.asc(root.get("sortOrder"));
        }
    },
    PRIORITY {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            // HIGH before MEDIUM before LOW: the enum is stored by name, so
            // alphabetical order does not work.
            return cb.asc(cb.<Integer>selectCase()
                    .when(cb.equal(root.get("priority"), Task.Priority.HIGH), 0)
                    .when(cb.equal(root.get("priority"), Task.Priority.LOW), 2)
                    .otherwise(1));
        }
    },
    DUE {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            // In PostgreSQL NULL sorts above everything, so ASC leaves the tasks
            // without a date at the end, which is what the user expects.
            return cb.asc(root.get("dueDate"));
        }
    },
    NEWEST {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            return cb.desc(root.get("createdAt"));
        }
    },
    OLDEST {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            return cb.asc(root.get("createdAt"));
        }
    },
    ALPHABETICAL {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            return cb.asc(root.get("title"));
        }
    };

    public abstract Order toOrder(CriteriaBuilder cb, Root<Task> root);

    public static TaskSort from(String raw) {
        if (raw == null) {
            return FILE;
        }
        try {
            return valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return FILE;
        }
    }
}