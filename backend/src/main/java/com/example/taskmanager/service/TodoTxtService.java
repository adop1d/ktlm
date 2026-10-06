package com.example.taskmanager.service;

import com.example.taskmanager.model.Task;
import com.example.taskmanager.repository.TaskRepository;
import com.example.taskmanager.todotxt.ParsedTask;
import com.example.taskmanager.todotxt.TodoTxtCodec;
import org.springframework.context.ApplicationEventPublisher;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.Map;

/**
 * Interoperabilidad con archivos todo.txt (tuxedo).
 *
 * <p>El archivo se trata como el espejo del usuario: la base de datos es la fuente de
 * verdad y {@code uid:} es la identidad estable que permite reconciliar ambos sentidos
 * sin duplicar.
 */
@Service
public class TodoTxtService {

    // MEDIUM no emite prioridad: es el estado por defecto y el archivo es del usuario.
    // Escribir "(B)" en cada línea contaminaría el todo.txt entero.
    private static final Map<Task.Priority, Character> PRIORITY_TO_TODO = Map.of(
            Task.Priority.HIGH, 'A',
            Task.Priority.LOW, 'C');

    private final TaskRepository taskRepository;
    private final TodoTxtCodec codec;
    private final ApplicationEventPublisher events;
    private final TodoStore store;
    private final TodoFileWatcher watcher;

    public TodoTxtService(
            TaskRepository taskRepository,
            TodoTxtCodec codec,
            ApplicationEventPublisher events,
            TodoStore store,
            TodoFileWatcher watcher) {
        this.taskRepository = taskRepository;
        this.codec = codec;
        this.events = events;
        this.store = store;
        this.watcher = watcher;
    }

    /** El archivo tal cual está en disco, sin reconciliar. */
    public String currentFile(Long userId) {
        return store.read(userId);
    }

    /** Escribe el archivo y avisa al vigilante de que el cambio es nuestro. */
    private void writeFile(Long userId, String content) {
        store.write(userId, content);
        watcher.recordWritten(userId, content);
        watcher.watch(userId);
    }

    /**
     * El todo.txt completo del usuario.
     *
     * <p>Sale del archivo, no de la base: el archivo es la fuente y la tabla es el índice
     * para poder filtrar y paginar. reconstruirlo desde la base perdería los comentarios y
     * el formato exacto, que es justo lo que hay que conservar.
     */
    public String export(Long userId) {
        return store.read(userId);
    }

    /**
     * Crea el archivo si no existe. Lo llama el navegador al vincularse, y con esto el
     * usuario no tiene que crear nada a mano para empezar.
     */
    public void ensureFile(Long userId) {
        if (store.read(userId).isEmpty()) {
            writeFile(userId, EMPTY_FILE);
        }
        watcher.watch(userId);
    }

    /** Reconstruye el archivo desde la base. Para cuando alguien edita el archivo a mano y se rompe. */
    public String rebuildFile(Long userId) {
        String content = codec.serialize(taskRepository.findByUserIdOrderBySortOrderAscIdAsc(userId).stream()
                .map(this::toParsed)
                .toList());
        writeFile(userId, content);
        return content;
    }

    public String hash(Long userId) {
        return store.hash(userId);
    }

    private static final String EMPTY_FILE = "";

    /**
     * Añade una línea al inbox.txt. El servidor no la procesa todavía: es una captura, no
     * una importación, y hacerlo sin que el cliente lo pida haría que una escritura fuera
     * de la app apareciera de golpe.
     */
    public void appendInbox(Long userId, String line) {
        store.appendInbox(userId, line);
    }

    /**
     * Vacía el inbox y lo pasa por el importador. Devuelve el archivo reconciliado.
     * Es idempotente: si el inbox ya estaba vacío, no toca nada.
     */
    public String drainInbox(Long userId) {
        String pending = store.consumeInbox(userId);
        if (pending.isBlank()) {
            return export(userId);
        }
        return importFile(userId, pending).file();
    }

    /**
     * Importa un archivo. Cada línea se hace coincidir por su token {@code uid:}: si no lo
     * tiene, se crea nueva y se le asigna uno. Nunca borra; las tareas ausentes del archivo
     * se quedan porque la semántica de borrado la decide el cliente al reconciliar.
     */
    @Transactional
    public ImportResult importFile(Long userId, String text) {
        List<ParsedTask> parsed = codec.parse(text);
        int imported = 0;
        int updated = 0;

        // Al completar una tarea recurrente, tuxedo inserta la instancia siguiente
        // conservando el mismo uid. Un uid identifica como mucho una fila, así que la
        // segunda aparición del mismo crea una tarea nueva en vez de machacar la primera.
        Set<String> seenUids = new HashSet<>();

        // Una línea sin uid no tiene identidad con la que reconocerse, y crearla siempre
        // duplicaba todo cuando tuxedo escribía dos veces antes de que la app devolviera los
        // uid. La salida es buscar por contenido, que solo es seguro si no hay ambigüedad.
        List<Task> candidates = taskRepository.findByUserId(userId);

        for (int i = 0; i < parsed.size(); i++) {
            ParsedTask line = parsed.get(i);
            String uid = line.todoUid();
            boolean knownUid = uid != null && !uid.isBlank() && seenUids.add(uid);

            Task task = null;
            if (knownUid) {
                task = taskRepository.findByUserIdAndTodoUid(userId, uid).orElse(null);
            }
            if (task == null) {
                Task byContent = findUnambiguousMatch(candidates, line);
                // Sin uid pero con coincidencia única, es la misma tarea: se actualiza y se
                // le queda su uid puesto. Si hay varias iguales, no se adivina.
                if (byContent != null && (uid == null || uid.isBlank())) {
                    task = byContent;
                }
            }

            boolean isNew = task == null;
            if (isNew) {
                task = new Task();
                task.setUserId(userId);
            }

            apply(task, line);
            // El uid solo se copia si corresponde a una fila ya existente. Si ya se había
            // visto, la tarea es nueva y necesita el suyo: dos filas no pueden compartir
            // identidad.
            if (knownUid) {
                task.setTodoUid(uid);
            }
            task.setSortOrder(i);
            task.updateTimestamp();
            taskRepository.save(task);

            if (task.getTodoUid() == null || task.getTodoUid().isBlank()) {
                // El id solo existe tras el primer insert: se usa como uid y se persiste.
                task.setTodoUid(String.valueOf(task.getId()));
                task.updateTimestamp();
                taskRepository.save(task);
            }

            if (isNew) {
                imported++;
            } else {
                updated++;
            }
        }

        String reconciled = codec.serialize(
                taskRepository.findByUserIdOrderBySortOrderAscIdAsc(userId).stream()
                        .map(this::toParsed)
                        .toList());
        writeFile(userId, reconciled);
        events.publishEvent(new TaskEventStream.TasksChanged(userId));
        return new ImportResult(imported, updated, parsed.size(), reconciled);
    }

    /** La única coincidencia por contenido, o null si no hay o si hay varias. */
    private Task findUnambiguousMatch(List<Task> candidates, ParsedTask line) {
        String wanted = contentKey(line);
        Task found = null;
        for (Task candidate : candidates) {
            if (!contentKey(toParsed(candidate)).equals(wanted)) {
                continue;
            }
            if (found != null) {
                // Ambigüedad: no se sabe cuál de las dos es, así que no se toca ninguna.
                return null;
            }
            found = candidate;
        }
        return found;
    }

    /**
     * Identidad de contenido: todo menos el uid —que es lo que a una línea nueva le falta— y
     * menos las fechas. La de creación la sella el servidor y una línea de tuxedo puede no
     * traerla; la de completado se deriva de `done`, que sí está aquí.
     */
    private String contentKey(ParsedTask line) {
        return String.join("|",
                String.valueOf(line.priority()),
                line.body(),
                String.valueOf(line.due()),
                String.valueOf(line.recurrence()),
                String.valueOf(line.threshold()),
                String.valueOf(line.done()),
                String.valueOf(line.projects()),
                String.valueOf(line.contexts()));
    }

    /**
     * Devuelve las completadas para que el cliente las escriba en done.txt y las quita de
     * la lista activa. Equivale a la tecla {@code A} de tuxedo.
     */
    @Transactional
    public ArchiveResult archive(Long userId) {
        List<Task> done = taskRepository.findByUserIdAndCompletedOrderBySortOrderAscIdAsc(userId, true);
        if (done.isEmpty()) {
            return new ArchiveResult(0, "");
        }
        String doneFile = codec.serialize(done.stream().map(this::toParsed).toList());
        store.appendDone(userId, doneFile);
        watcher.recordWritten(userId, store.read(userId));
        taskRepository.deleteAll(done);
        events.publishEvent(new TaskEventStream.TasksChanged(userId));
        return new ArchiveResult(done.size(), doneFile);
    }

    // --- Mapeo Task <-> línea todo.txt ----------------------------------------------------

    private ParsedTask toParsed(Task task) {
        return new ParsedTask(
                PRIORITY_TO_TODO.get(task.getPriority()),
                task.getCreatedAt() == null ? null : task.getCreatedAt().toLocalDate(),
                task.getTitle(),
                List.copyOf(task.getProjects()),
                List.copyOf(task.getContexts()),
                task.getDueDate(),
                task.getRecurrence(),
                task.getThreshold(),
                task.isCompleted(),
                task.getCompletedAt() == null ? null : task.getCompletedAt().toLocalDate(),
                task.getTodoUid(),
                parseExtras(task.getExtras()),
                "");
    }

    private void apply(Task task, ParsedTask line) {
        task.setTitle(line.body());
        task.setPriority(toPriority(line.priority()));
        task.setDueDate(line.due());
        task.setRecurrence(line.recurrence());
        task.setThreshold(line.threshold());
        task.setProjects(new LinkedHashSet<>(line.projects()));
        task.setContexts(new LinkedHashSet<>(line.contexts()));
        task.setExtras(formatExtras(line.extras()));
        task.setCompleted(line.done());
        task.setCompletedAt(line.done()
                ? LocalDateTime.of(line.completed() == null ? LocalDate.now() : line.completed(), LocalTime.MIDNIGHT)
                : null);
        if (line.created() != null) {
            task.setCreatedAt(LocalDateTime.of(line.created(), LocalTime.MIDNIGHT));
        }
    }

    private Task.Priority toPriority(Character todoPriority) {
        if (todoPriority == null) {
            return Task.Priority.MEDIUM;
        }
        char c = Character.toUpperCase(todoPriority);
        if (c == 'A') {
            return Task.Priority.HIGH;
        }
        if (c == 'C') {
            return Task.Priority.LOW;
        }
        // B y cualquier letra restante colapsan a la única prioridad intermedia del dominio.
        return Task.Priority.MEDIUM;
    }

    /** Los extras se guardan como tokens "clave:valor" separados por espacios. */
    private String formatExtras(Map<String, String> extras) {
        if (extras == null || extras.isEmpty()) {
            return null;
        }
        List<String> tokens = new ArrayList<>();
        extras.forEach((key, value) -> {
            if (key != null && !key.isBlank() && value != null && !value.isBlank()) {
                tokens.add(key + ":" + value);
            }
        });
        return tokens.isEmpty() ? null : String.join(" ", tokens);
    }

    private Map<String, String> parseExtras(String raw) {
        Map<String, String> extras = new LinkedHashMap<>();
        if (raw == null || raw.isBlank()) {
            return extras;
        }
        for (String token : raw.trim().split("\\s+")) {
            int colon = token.indexOf(':');
            if (colon > 0 && colon < token.length() - 1) {
                extras.put(token.substring(0, colon), token.substring(colon + 1));
            }
        }
        return extras;
    }

    /** @param parsed total de tareas leídas del archivo */
    public record ImportResult(int imported, int updated, int parsed, String file) {}

    /** @param doneFile contenido para(done.txt) */
    public record ArchiveResult(int archived, String doneFile) {}
}