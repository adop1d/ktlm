package ktm.controller;

import ktm.security.CurrentUser;
import ktm.service.TaskBatchService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Applies several operations as a single unit. The work lives in
 * {@link TaskBatchService}; here there is only HTTP translation.
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
            // applied is always 0: the whole transaction went down.
            return ResponseEntity.badRequest().body(Map.of(
                    "applied", 0,
                    "failedAt", e.getFailedAt(),
                    "error", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("applied", 0, "error", e.getMessage()));
        }
    }
}