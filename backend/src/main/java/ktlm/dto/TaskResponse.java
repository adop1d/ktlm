package ktlm.dto;

import ktlm.model.Task;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Representación de solo lectura de una tarea para el cliente. */
public record TaskResponse(
        Long id,
        String title,
        String description,
        boolean completed,
        Task.Priority priority,
        LocalDate dueDate,
        Integer sortOrder,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        LocalDateTime completedAt,
        String recurrence,
        String threshold,
        String note,
        String todoUid,
        List<String> projects,
        List<String> contexts) {

    public static TaskResponse from(Task task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.isCompleted(),
                task.getPriority(),
                task.getDueDate(),
                task.getSortOrder(),
                task.getCreatedAt(),
                task.getUpdatedAt(),
                task.getCompletedAt(),
                task.getRecurrence(),
                task.getThreshold(),
                task.getNote(),
                task.getTodoUid(),
                List.copyOf(task.getProjects()),
                List.copyOf(task.getContexts()));
    }
}