package ktlm.repository;

import ktlm.model.Task;
import ktlm.model.TaskFilter;
import ktlm.model.TaskSort;
import jakarta.persistence.criteria.Join;
import org.springframework.data.jpa.domain.Specification;

/**
 * Predicates for the paginated list.
 *
 * <p>The per-user scope is always applied and from a single place: without it, a
 * forgotten specification would return another account's tasks.
 */
public final class TaskSpecifications {

    private TaskSpecifications() {}

    /** Mandatory scope. Every list query must start here. */
    public static Specification<Task> ownedBy(Long userId) {
        return (root, query, cb) -> cb.equal(root.get("userId"), userId);
    }

    public static Specification<Task> withFilter(TaskFilter filter) {
        if (filter.completed() == null) {
            return null;
        }
        return (root, query, cb) -> cb.equal(root.get("completed"), filter.completed());
    }

    /** Searches title or description, case-insensitive. The wildcard escapes the %. */
    public static Specification<Task> matching(String term) {
        if (term == null || term.isBlank()) {
            return null;
        }
        String needle = "%" + term.trim().toLowerCase().replace("\\", "\\\\").replace("%", "\\%") + "%";
        return (root, query, cb) -> cb.or(
                cb.like(cb.lower(root.get("title")), needle, '\\'),
                cb.like(cb.lower(cb.coalesce(root.get("description"), "")), needle, '\\'));
    }

    public static Specification<Task> inProject(String project) {
        if (project == null || project.isBlank()) {
            return null;
        }
        return (root, query, cb) -> {
            Join<Task, String> join = root.join("projects");
            return cb.equal(join, project.trim());
        };
    }

    public static Specification<Task> inContext(String context) {
        if (context == null || context.isBlank()) {
            return null;
        }
        return (root, query, cb) -> {
            Join<Task, String> join = root.join("contexts");
            return cb.equal(join, context.trim());
        };
    }

    /** Applies the chosen ordering plus an id tiebreaker, so pagination is stable. */
    public static Specification<Task> sortedBy(TaskSort sort) {
        return (root, query, cb) -> {
            query.orderBy(sort.toOrder(cb, root), cb.asc(root.get("id")));
            return cb.conjunction();
        };
    }

    /** Composes the non-null specifications. */
    @SafeVarargs
    public static Specification<Task> allOf(Specification<Task>... parts) {
        Specification<Task> combined = null;
        for (Specification<Task> part : parts) {
            if (part == null) {
                continue;
            }
            combined = combined == null ? part : combined.and(part);
        }
        return combined == null ? (root, query, cb) -> cb.conjunction() : combined;
    }
}