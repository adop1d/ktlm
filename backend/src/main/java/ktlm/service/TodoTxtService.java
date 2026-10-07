package ktlm.service;

import ktlm.model.Task;
import ktlm.repository.TaskRepository;
import ktlm.todotxt.ParsedTask;
import ktlm.todotxt.TodoTxtCodec;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
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
 * Interoperability with todo.txt files (tuxedo).
 *
 * <p>The file is treated as the user's mirror: the database is the source of truth and
 * {@code uid:} is the stable identity that lets both directions be reconciled without
 * duplicating anything.
 */
@Service
public class TodoTxtService {

    // MEDIUM emits no priority: it is the default state and the file belongs to the user.
    // Writing "(B)" on every line would contaminate the whole todo.txt.
    /** File size cap. 10 000 tasks of 500 characters fall well short of it. */
    private static final int MAX_FILE = 8_000_000;

    /** The note token in the file. It lives in extras, but has its own column. */
    private static final String KEY_NOTE = "note";

    /** Same arrangement for the start date: a column here, a `start:` token there. */
    private static final String KEY_START = "start";

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

    /** The file exactly as it is on disk, without reconciling. */
    public String currentFile(Long userId) {
        return store.read(userId);
    }

    /** Writes the file and tells the watcher the change came from us. */
    private void writeFile(Long userId, String content) {
        store.write(userId, content);
        watcher.recordWritten(userId, content);
        watcher.watch(userId);
    }

    /**
     * The user's complete todo.txt.
     *
     * <p>It comes from the file, not the database: the file is the source and the table is
     * the index, so that filtering and pagination are possible. Rebuilding it from the
     * database would lose the comments and the exact formatting, which is precisely what
     * has to be preserved.
     */
    public String export(Long userId) {
        return store.read(userId);
    }

    /**
     * Creates the file if it does not exist. The browser calls it on linking, so the user
     * does not have to create anything by hand to get started.
     */
    public void ensureFile(Long userId) {
        if (store.read(userId).isEmpty()) {
            writeFile(userId, EMPTY_FILE);
        }
        watcher.watch(userId);
    }

    /**
     * Dumps the current state to disk and notifies the open sessions.
     *
     * <p>The browser does not need it: it keeps its own mirror and sends the whole file
     * with every change. A client without a mirror —the MCP server, a script— does: without
     * this, the change would reach the database and never show up in the todo.txt.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public String persistToFile(Long userId) {
        List<Task> tasks = taskRepository.findByUserIdOrderBySortOrderAscIdAsc(userId);
        prepararParaEscribir(tasks);
        String content = codec.serialize(tasks.stream().map(this::toParsed).toList());
        writeFile(userId, content);
        events.publishEvent(new TaskEventStream.TasksChanged(userId));
        return content;
    }

    /**
     * Gives every task the uid and the ordering the file needs and the database does not
     * have yet.
     *
     * <p>The importer assigns those on read, but some changes do not go through it: a batch
     * from the MCP server, a note. If the file were written as-is, the line would come out
     * without {@code uid:} and with the ordering at zero —and the client, which calls the
     * API with the uid, would point at task 0. The change would be lost without an error,
     * which is the worst thing that can happen.
     *
     * <p>The uid is the row id: a number the server already has, not one that has to be
     * invented and kept in place.
     *
     * <p>And the importer is not called here, even though it could be: it would serialize
     * lines without a uid and could not match them against the tasks that are actually
     * theirs. With five tasks of the same title there is no unique match, so it would
     * create five new tasks and leave the old ones orphaned. That is a loop, not a help.
     */
    private void prepararParaEscribir(List<Task> tasks) {
        List<Task> sucias = new ArrayList<>();
        for (int i = 0; i < tasks.size(); i++) {
            Task task = tasks.get(i);
            boolean sucia = false;
            if (task.getSortOrder() == null || task.getSortOrder() != i) {
                task.setSortOrder(i);
                sucia = true;
            }
            if (task.getId() != null && (task.getTodoUid() == null || task.getTodoUid().isBlank())) {
                task.setTodoUid(String.valueOf(task.getId()));
                sucia = true;
            }
            if (sucia) {
                task.updateTimestamp();
                sucias.add(task);
            }
        }
        if (!sucias.isEmpty()) {
            taskRepository.saveAll(sucias);
            taskRepository.flush();
        }
    }

    /**
     * Rebuilds the file from the database. For when someone edits the file by hand and it
     * breaks.
     *
     * <p>It is {@link #persistToFile}: rebuilding and dumping are the same operation, and
     * having them separate invited one of them to skip preparing the uid and the ordering
     * —which is exactly what left it writing an unusable file.
     */
    public String rebuildFile(Long userId) {
        return persistToFile(userId);
    }

    public String hash(Long userId) {
        return store.hash(userId);
    }

    private static final String EMPTY_FILE = "";

    /**
     * Appends a line to inbox.txt. The server does not process it yet: it is a capture, not
     * an import, and doing it without the client asking would make a write from outside the
     * app appear all at once.
     */
    public void appendInbox(Long userId, String line) {
        store.appendInbox(userId, line);
    }

    /**
     * Empties the inbox and runs it through the importer. Returns the reconciled file.
     * It is idempotent: if the inbox was already empty, it touches nothing.
     */
    public String drainInbox(Long userId) {
        String pending = store.consumeInbox(userId);
        if (pending.isBlank()) {
            return export(userId);
        }
        return importFile(userId, pending).file();
    }

    /**
     * Imports a file. Each line is matched by its {@code uid:} token: without one it is
     * created anew and given one. It never deletes; tasks absent from the file stay
     * because the delete semantics are decided by the client when reconciling.
     */
    @Transactional
    public ImportResult importFile(Long userId, String text) {
        if (text != null && text.length() > MAX_FILE) {
            throw new IllegalArgumentException("El archivo es demasiado grande");
        }
        List<ParsedTask> parsed = codec.parse(text);
        int imported = 0;
        int updated = 0;

        // When completing a recurring task, tuxedo inserts the next instance keeping the
        // same uid. A uid identifies at most one row, so the second occurrence of the same
        // one creates a new task instead of overwriting the first.
        Set<String> seenUids = new HashSet<>();

        // A line without a uid has no identity to recognize it by, and creating it always
        // duplicated everything when tuxedo wrote twice before the app returned the uids.
        // The way out is to search by content, which is only safe when there is no
        // ambiguity.
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
                // Without a uid but with a unique match, it is the same task: it gets
                // updated and keeps its uid. If several are identical, we do not guess.
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
            // The uid is only copied when it belongs to an existing row. If it had already
            // been seen, the task is new and needs its own: two rows cannot share an
            // identity.
            if (knownUid) {
                task.setTodoUid(uid);
            }
            task.setSortOrder(i);
            task.updateTimestamp();
            taskRepository.save(task);

            if (task.getTodoUid() == null || task.getTodoUid().isBlank()) {
                // The id only exists after the first insert: it is used as the uid and
                // persisted.
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

    /** The only content match, or null when there is none or there are several. */
    private Task findUnambiguousMatch(List<Task> candidates, ParsedTask line) {
        String wanted = contentKey(line);
        Task found = null;
        for (Task candidate : candidates) {
            if (!contentKey(toParsed(candidate)).equals(wanted)) {
                continue;
            }
            if (found != null) {
                // Ambiguity: we do not know which of the two it is, so neither is touched.
                return null;
            }
            found = candidate;
        }
        return found;
    }

    /**
     * Content identity: everything but the uid —which is exactly what a new line lacks—
     * and the dates. The creation date is stamped by the server and a tuxedo line may not
     * carry it; the completed one is derived from `done`, which is present here.
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
     * Returns the completed ones so the client can write them to done.txt and take them off
     * the active list. Equivalent to tuxedo's {@code A} key.
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

    // --- Task <-> todo.txt line mapping ------------------------------------------------

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
                conTags(parseExtras(task.getExtras()), task.getNote(), task.getStartDate()),
                "");
    }

    private void apply(Task task, ParsedTask line) {
        Map<String, String> extras = new LinkedHashMap<>(line.extras() == null ? Map.of() : line.extras());
        // `note` has its own column. If it also stayed in extras, rewriting the file would
        // emit it twice on the same line.
        String note = extras.remove(KEY_NOTE);
        task.setNote(note == null || note.isBlank() ? null : note);

        String start = extras.remove(KEY_START);
        try {
            task.setStartDate(start == null || start.isBlank() ? null : LocalDate.parse(start.trim()));
        } catch (DateTimeParseException e) {
            // A malformed date is not worth failing an import over, and it is already gone
            // from extras: it would otherwise come back as a raw token nobody can query.
            task.setStartDate(null);
        }
        task.setTitle(line.body());
        task.setPriority(toPriority(line.priority()));
        task.setDueDate(line.due());
        task.setRecurrence(line.recurrence());
        task.setThreshold(line.threshold());
        task.setProjects(new LinkedHashSet<>(line.projects()));
        task.setContexts(new LinkedHashSet<>(line.contexts()));
        task.setExtras(formatExtras(extras));
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
        // B and any remaining letter collapse to the domain's single intermediate priority.
        return Task.Priority.MEDIUM;
    }

    /**
     * The note and the start date go back into extras, which is where the codec writes them
     * as `note:` and `start:`.
     *
     * <p>They are removed from extras on the way in and put back on the way out, so they
     * never end up in the line twice — and if they did, the second one would be the one the
     * parser saw.
     */
    private static Map<String, String> conTags(
            Map<String, String> extras, String note, LocalDate startDate) {
        Map<String, String> resultado = new LinkedHashMap<>(extras);
        if (note != null && !note.isBlank()) {
            resultado.put(KEY_NOTE, note);
        }
        if (startDate != null) {
            resultado.put(KEY_START, startDate.toString());
        }
        return resultado;
    }

    /** Extras are stored as space-separated "key:value" tokens. */
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

    /** @param parsed total number of tasks read from the file */
    public record ImportResult(int imported, int updated, int parsed, String file) {}

    /** @param doneFile content for done.txt */
    public record ArchiveResult(int archived, String doneFile) {}
}