package com.example.taskmanager.controller;

import com.example.taskmanager.security.CurrentUser;
import com.example.taskmanager.service.TaskBatchService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Aplica varias operaciones como una sola unidad. El trabajo está en
 * {@link TaskBatchService}; aquí solo hay translating de HTTP.
 */
@RestController
@RequestMapping("/api/tasks/batch")
public class TaskBatchController {

    private final TaskBatchService batch;
    private final CurrentUser currentUser;

    public TaskBatchController(TaskBatchService batch, CurrentUser currentUser) {
        this.batch = batch;
        this.currentUser = currentUser;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<Map<String, Object>> apply(@RequestBody Map<String, Object> body) {
        Long userId = currentUser.id();
        try {
            List<?> operations = (List<?>) body.get("operations");
            List<Map<String, Object>> results = batch.apply(userId, operations);
            return ResponseEntity.ok(Map.of("applied", results.size(), "results", results));
        } catch (TaskBatchService.BatchFailed e) {
            // applied 0 siempre: la transacción entera ha caído.
            return ResponseEntity.badRequest().body(Map.of(
                    "applied", 0,
                    "failedAt", e.getFailedAt(),
                    "error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("applied", 0, "error", e.getMessage()));
        }
    }
}