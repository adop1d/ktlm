package ktm.service;

import ktm.dto.TaskRequest;
import ktm.model.Task;
import ktm.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Applies a batch of operations as a single unit.
 *
 * <p>It lives in the service and not in the controller for one concrete reason: the
 * transaction. If each operation opens its own, a failure on the fifth leaves the first
 * four applied — a half-done change is worse than no change. Here the transaction is one,
 * and the only way anything reaches the database is the whole batch passing.
 *
 * <p>The file is written after the commit, not before. Writing it inside would leave a
 * todo.txt counting tasks that later vanished, if the commit failed.
 */
@Service
public class TaskBatchService {

    private static final int MAX_OPERATIONS = 200;

    private final TaskService tasks;
    private final TodoTxtService todoTxt;

    public TaskBatchService(TaskService tasks, TodoTxtService todoTxt) {
        this.tasks = tasks;
        this.todoTxt = todoTxt;
    }

    /** A batch that stopped halfway. It says where, so the client can fix it. */
    public static class BatchFailed extends RuntimeException {
        private final int failedAt;

        BatchFailed(int failedAt, String detail, Throwable cause) {
            super(detail, cause);
            this.failedAt = failedAt;
        }

        public int getFailedAt() {
            return failedAt;
        }
    }

    @Transactional
    public List<Map<String, Object>> apply(Long userId, List<?> operations) {
        if (operations == null || operations.isEmpty()) {
            throw new IllegalArgumentException("operations debe ser una lista no vacía");
        }
        if (operations.size() > MAX_OPERATIONS) {
            throw new IllegalArgumentException("máximo %d operaciones por lote".formatted(MAX_OPERATIONS));
        }

        List<Map<String, Object>> results = new ArrayList<>(operations.size());
        for (int i = 0; i < operations.size(); i++) {
            try {
                results.add(applyOne(operations.get(i), userId));
            } catch (RuntimeException e) {
                throw new BatchFailed(i, "la operación %d (%s) falló: %s".formatted(
                        i, describe(operations.get(i)), e.getMessage()), e);
            }
        }

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    todoTxt.persistToFile(userId);
                }
            });
        } else {
            todoTxt.persistToFile(userId);
        }

        return results;
    }

    private static String describe(Object item) {
        return item instanceof Map<?, ?> map ? String.valueOf(map.get("op")) : "?";
    }

    private Map<String, Object> applyOne(Object item, Long userId) {
        if (!(item instanceof Map<?, ?> raw)) {
            throw new IllegalArgumentException("cada operación debe ser un objeto");
        }
        String op = String.valueOf(raw.get("op"));
        Long target = uidOf(raw.get("uid"));

        if ("create".equals(op)) {
            Task created = tasks.createTask(toRequest(raw), userId);
            // The todoUid does not exist yet: it is assigned when the file is written, after
            // the commit. What the client needs now is the id, which is stable.
            return Map.of("op", op, "uid", created.getId(), "ok", true);
        }
        if ("update".equals(op)) {
            return done(op, tasks.updateTask(require(target, op), userId, toRequest(raw)));
        }
        if ("toggle".equals(op)) {
            return done(op, tasks.toggleTaskCompletion(require(target, op), userId));
        }
        if ("delete".equals(op)) {
            tasks.deleteTask(require(target, op), userId);
            return Map.of("op", op, "uid", String.valueOf(target), "ok", true);
        }
        throw new IllegalArgumentException("operación desconocida: " + op);
    }

    private static Map<String, Object> done(String op, Task task) {
        String todoUid = task.getTodoUid();
        return Map.of("op", op, "uid", todoUid == null ? 0L : Long.valueOf(todoUid), "ok", true);
    }

    private static Long require(Long uid, String op) {
        if (uid == null) {
            throw new IllegalArgumentException(op + " necesita un uid");
        }
        return uid;
    }

    private static Long uidOf(Object raw) {
        if (raw == null || String.valueOf(raw).isBlank()) {
            return null;
        }
        return Long.valueOf(raw.toString());
    }

    /**
     * Only the fields present. The absent ones go as null and {@code applyTo} leaves them
     * as they are: a reordering batch must not wipe out projects along the way.
     *
     * <p>The note is deliberately not here. It is a path inside the user's directory and
     * therefore has to be validated; allowing it in the batch would leave that door open.
     * Notes come in through {@code PUT /api/tasks/{id}/note}.
 */
    static TaskRequest toRequest(Map<?, ?> raw) {
        return new TaskRequest(
                str(raw.get("title")),
                str(raw.get("description")),
                bool(raw.get("completed")),
                enumValue(raw.get("priority"), Task.Priority.class),
                raw.get("dueDate") == null ? null : java.time.LocalDate.parse(str(raw.get("dueDate"))),
                raw.get("startDate") == null ? null : java.time.LocalDate.parse(str(raw.get("startDate"))),
                raw.get("sortOrder") == null ? null : Integer.valueOf(str(raw.get("sortOrder"))),
                str(raw.get("recurrence")),
                str(raw.get("threshold")),
                null, // the note is not written from here: it is a path and must be validated
                strList(raw.get("projects")),
                strList(raw.get("contexts")));
    }

    private static <E extends Enum<E>> E enumValue(Object raw, Class<E> type) {
        String text = str(raw);
        return text == null ? null : Enum.valueOf(type, text.toUpperCase());
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = value.toString().trim();
        return text.isEmpty() ? null : text;
    }

    private static Boolean bool(Object value) {
        return value == null ? null : Boolean.valueOf(String.valueOf(value));
    }

    private static List<String> strList(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof List<?> list) {
            return list.stream().map(Object::toString).map(String::trim).filter(s -> !s.isEmpty()).toList();
        }
        String single = str(value);
        return single == null ? null : List.of(single);
    }
}