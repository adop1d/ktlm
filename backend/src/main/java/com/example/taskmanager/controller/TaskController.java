package com.example.taskmanager.controller;

import com.example.taskmanager.dto.TaskCounts;
import com.example.taskmanager.dto.TaskPageResponse;
import com.example.taskmanager.dto.TaskRequest;
import com.example.taskmanager.dto.TaskResponse;
import com.example.taskmanager.model.TaskFilter;
import com.example.taskmanager.model.TaskSort;
import com.example.taskmanager.security.CurrentUser;
import com.example.taskmanager.service.TaskEventStream;
import com.example.taskmanager.service.TaskService;
import com.example.taskmanager.service.TodoTxtService;
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
    private final TodoTxtService todoTxtService;

    public TaskController(
            TaskService taskService,
            CurrentUser currentUser,
            TodoTxtService todoTxtService,
            TaskEventStream events) {
        this.taskService = taskService;
        this.currentUser = currentUser;
        this.todoTxtService = todoTxtService;
        this.events = events;
    }

    /**
     * Cambios de esta cuenta, empujados por el servidor. Es lo que sustituye a preguntar
     * cada cierto tiempo: en cuanto alguien completa una tarea desde el móvil, la otra
     * pantalla se entera.
     */
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public SseEmitter stream() {
        return events.subscribe(currentUser.id());
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
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
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public TaskCounts getCounts() {
        return taskService.getCounts(currentUser.id());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public ResponseEntity<TaskResponse> getTaskById(@PathVariable Long id) {
        return taskService.getTaskById(id, currentUser.id())
                .map(TaskResponse::from)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public ResponseEntity<TaskResponse> createTask(@Valid @RequestBody TaskRequest task) {
        TaskResponse created = TaskResponse.from(taskService.createTask(task, currentUser.id()));
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public TaskResponse updateTask(@PathVariable Long id, @Valid @RequestBody TaskRequest taskDetails) {
        return TaskResponse.from(taskService.updateTask(id, currentUser.id(), taskDetails));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        taskService.deleteTask(id, currentUser.id());
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/toggle")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public TaskResponse toggleTaskCompletion(@PathVariable Long id) {
        return TaskResponse.from(taskService.toggleTaskCompletion(id, currentUser.id()));
    }

    @GetMapping(value = "/export", produces = "text/plain; charset=UTF-8")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public ResponseEntity<String> export() {
        return ResponseEntity.ok(todoTxtService.export(currentUser.id()));
    }

    @PostMapping(value = "/import", consumes = "text/plain", produces = "application/json")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public TodoTxtService.ImportResult importFile(@RequestBody String todoTxt) {
        return todoTxtService.importFile(currentUser.id(), todoTxt);
    }

    @PostMapping("/archive")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public TodoTxtService.ArchiveResult archive() {
        return todoTxtService.archive(currentUser.id());
    }

}