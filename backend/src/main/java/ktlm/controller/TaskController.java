package ktlm.controller;

import ktlm.dto.TaskCounts;
import ktlm.dto.TaskPageResponse;
import ktlm.dto.TaskRequest;
import ktlm.dto.TaskResponse;
import ktlm.model.TaskFilter;
import ktlm.model.TaskSort;
import ktlm.security.CurrentUser;
import ktlm.service.TaskEventStream;
import ktlm.service.TodoStore;
import ktlm.service.TaskService;
import ktlm.service.TodoTxtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final CurrentUser currentUser;
    private final TaskEventStream events;
    private final TodoStore todoStore;
    private final TodoTxtService todoTxtService;

    public TaskController(
            TaskService taskService,
            CurrentUser currentUser,
            TodoTxtService todoTxtService,
            TaskEventStream events,
            TodoStore todoStore) {
        this.taskService = taskService;
        this.currentUser = currentUser;
        this.todoTxtService = todoTxtService;
        this.events = events;
        this.todoStore = todoStore;
    }

    /**
     * Cambios de esta cuenta, empujados por el servidor. Es lo que sustituye a preguntar
     * cada cierto tiempo: en cuanto alguien completa una tarea desde el móvil, la otra
     * pantalla se entera.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public SseEmitter stream() {
        return events.subscribe(currentUser.id());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public TaskPageResponse getTasks(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(defaultValue = "all") String filter,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String project,
            @RequestParam(required = false) String context,
            @RequestParam(defaultValue = "file") String sort) {
        return taskService.getTasks(currentUser.id(), page, size,
                TaskFilter.from(filter), q, project, context, TaskSort.from(sort));
    }

    @GetMapping("/counts")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public TaskCounts getCounts() {
        return taskService.getCounts(currentUser.id());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<TaskResponse> getTaskById(@PathVariable Long id) {
        return taskService.getTaskById(id, currentUser.id())
                .map(TaskResponse::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<TaskResponse> createTask(@Valid @RequestBody TaskRequest task) {
        TaskResponse created = TaskResponse.from(taskService.createTask(task, currentUser.id()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public TaskResponse updateTask(@PathVariable Long id, @Valid @RequestBody TaskRequest taskDetails) {
        return TaskResponse.from(taskService.updateTask(id, currentUser.id(), taskDetails));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id, currentUser.id());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public TaskResponse toggleTaskCompletion(@PathVariable Long id) {
        return TaskResponse.from(taskService.toggleTaskCompletion(id, currentUser.id()));
    }

    @GetMapping(value = "/export", produces = "text/plain; charset=UTF-8")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<String> export() {
        return ResponseEntity.ok(todoTxtService.export(currentUser.id()));
    }

    @PostMapping(value = "/import", consumes = "text/plain", produces = "application/json")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public TodoTxtService.ImportResult importFile(@RequestBody String todoTxt) {
        return todoTxtService.importFile(currentUser.id(), todoTxt);
    }

    // ---------- El archivo, ahora del servidor ----------

    /**
     * El todo.txt tal cual está en disco. Es lo que consume el navegador para el espejo y
     * lo que leería un servidor MCP: mismo archivo, mismos bytes.
     */
    @GetMapping(value = "/file", produces = "text/plain; charset=UTF-8")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<String> readFile() {
        Long userId = currentUser.id();
        todoTxtService.ensureFile(userId);
        return ResponseEntity.ok()
                .eTag('"' + todoTxtService.hash(userId) + '"')
                .body(todoTxtService.export(userId));
    }

    /**
     * Reemplaza el archivo entero. La respuesta trae el contenido reconciliado, que es el
     * que hay que escribir: si el cliente guardara lo que envió sin más, volvería a meter
     * los uid antiguos.
     */
    @PutMapping(value = "/file", consumes = "text/plain", produces = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public String replaceFile(@RequestBody String todoTxt) {
        return todoTxtService.importFile(currentUser.id(), todoTxt).file();
    }

    /** Reconstruye el archivo desde la base. Para cuando se edita a mano y se rompe. */
    @PostMapping(value = "/file/rebuild", produces = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public String rebuildFile() {
        return todoTxtService.rebuildFile(currentUser.id());
    }

    /** Lo que hay en done.txt: la vista de archivo, ahora servida por el servidor. */
    @GetMapping("/archived")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public List<String> archived() {
        return todoStore.readDoneLines(currentUser.id());
    }

    /**
     * Una línea al inbox.txt. Cualquier cosa que sepa escribir una línea ahí crea una
     * tarea: un atajo de iOS, un cron, un `echo`.
     */
    @PostMapping(value = "/inbox", consumes = "text/plain", produces = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public String appendToInbox(@RequestBody String line) {
        Long userId = currentUser.id();
        todoTxtService.appendInbox(userId, line);
        return todoTxtService.drainInbox(userId);
    }

    /**
     * Vacía el inbox pasándolo por el importador. Un archivo con mensajes esperaría al
     * próximo ciclo; esto lo resuelve ya, que es lo que hace el servidor MCP.
     */
    @PostMapping(value = "/inbox/drain", produces = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public String drainInbox() {
        Long userId = currentUser.id();
        todoTxtService.drainInbox(userId);
        return todoTxtService.export(userId);
    }

    // Sin ROLE_MCP a propósito: archivar es irreversible desde la app y se decidió que lo
    // haga una persona. El resto de la API sí acepta un token de servicio.
    @PostMapping("/archive")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public TodoTxtService.ArchiveResult archive() {
        return todoTxtService.archive(currentUser.id());
    }

}