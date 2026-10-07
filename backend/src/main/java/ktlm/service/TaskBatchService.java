package ktlm.service;

import ktlm.dto.TaskRequest;
import ktlm.model.Task;
import ktlm.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Aplica un lote de operaciones como una sola unidad.
 *
 * <p>Vive en el servicio y no en el controlador por una razón concreta: la transacción.
 * Si cada operación abre la suya, un fallo en la quinta deja las cuatro primeras
 * aplicadas — un cambio a medias es peor que no cambiar. Aquí la transacción es una, y
 * la única forma de que algo llegue a la base es que el lote entero pase.
 *
 * <p>El archivo se escribe después de confirmar, no antes. Escribirlo dentro dejaría un
 * todo.txt que cuenta tareas que luego desaparecieron, si el commit fallara.
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

    /** Un lote que se paró a mitad. Dice dónde, para que el cliente pueda arreglarlo. */
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
            // El todoUid todavía no existe: se asigna al escribir el archivo, después del
            // commit. Lo que el cliente necesita ahora es el id, que sí es estable.
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
     * Solo los campos presentes. Los ausentes van a null y {@code applyTo} los deja como
     * están: un lote de reordenación no debe ir borrando proyectos por el camino.
     *
     * <p>La nota no está aquí a propósito. Es una ruta dentro del directorio del usuario y
     * por lo tanto hay que validarla; ponerla en el lote dejaría esa puerta abierta.
     * Las notas entran por {@code PUT /api/tasks/{id}/note}.
     */
    static TaskRequest toRequest(Map<?, ?> raw) {
        return new TaskRequest(
                str(raw.get("title")),
                str(raw.get("description")),
                bool(raw.get("completed")),
                enumValue(raw.get("priority"), Task.Priority.class),
                raw.get("dueDate") == null ? null : java.time.LocalDate.parse(str(raw.get("dueDate"))),
                raw.get("sortOrder") == null ? null : Integer.valueOf(str(raw.get("sortOrder"))),
                str(raw.get("recurrence")),
                str(raw.get("threshold")),
                null, // la nota no se escribe desde aquí: es una ruta y hay que validarla
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