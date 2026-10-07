package ktlm.model;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Root;

/**
 * Modo de orden de la lista paginada. `file`, `priority` y `due` son los tres ciclos de tuxedo;
 * los otros tres cubren lo que la UI ya ofrecía.
 *
 * <p>El orden se expresa sobre el árbol de criterios en vez de con {@code Sort} porque la
 * prioridad necesita una expresión condicional que {@code Sort} no puede representar.
 */
public enum TaskSort {
    /** Orden del archivo: sortOrder, que es la posición en el todo.txt. */
    FILE {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            return cb.asc(root.get("sortOrder"));
        }
    },
    PRIORITY {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            // HIGH antes que MEDIUM antes que LOW: el enum se almacena por nombre, así que
            // el orden alfabético no sirve.
            return cb.asc(cb.<Integer>selectCase()
                    .when(cb.equal(root.get("priority"), Task.Priority.HIGH), 0)
                    .when(cb.equal(root.get("priority"), Task.Priority.LOW), 2)
                    .otherwise(1));
        }
    },
    DUE {
        @Override
        public Order toOrder(CriteriaBuilder cb, Root<Task> root) {
            // En PostgreSQL NULL se ordena como mayor que todo, así que ASC deja las tareas
            // sin fecha al final, que es lo que espera el usuario.
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