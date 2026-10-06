package com.example.taskmanager.dto;

import com.example.taskmanager.model.Task;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Payload de escritura de una tarea. Deliberadamente NO expone id, userId, createdAt,
 * updatedAt ni todoUid: la identidad y las marcas de tiempo las fija el servidor.
 *
 * <p>El título es opcional porque el mismo payload sirve para un PUT parcial —reordenar el
 * archivo manda solo `sortOrder`— y para un POST. La obligatoriedad la impone el servicio al
 * crear, que es donde de verdad importa.
 */
public record TaskRequest(
        @Size(max = 500, message = "Title must not exceed 500 characters")
        String title,

        @Size(max = 4000, message = "Description must not exceed 4000 characters")
        String description,

        Boolean completed,

        Task.Priority priority,

        LocalDate dueDate,

        Integer sortOrder,

        String recurrence,

        String threshold,

        List<String> projects,

        List<String> contexts) {

    /** Aplica este payload sobre una entidad existente. Los campos ausentes se conservan. */
    public void applyTo(Task task) {
        if (title != null) {
            task.setTitle(title.trim());
        }
        if (description != null) {
            task.setDescription(description.isBlank() ? null : description);
        }
        if (completed != null) {
            task.setCompleted(completed);
            // La fecha de completado es coherente con el estado, no la fija el cliente.
            task.setCompletedAt(completed ? LocalDateTime.now() : null);
        }
        if (priority != null) {
            task.setPriority(priority);
        }
        if (dueDate != null) {
            task.setDueDate(dueDate);
        }
        if (sortOrder != null) {
            task.setSortOrder(sortOrder);
        }
        if (recurrence != null) {
            task.setRecurrence(recurrence.isBlank() ? null : recurrence.trim());
        }
        if (threshold != null) {
            task.setThreshold(threshold.isBlank() ? null : threshold.trim());
        }
        if (projects != null) {
            task.setProjects(new LinkedHashSet<>(projects));
        }
        if (contexts != null) {
            task.setContexts(new LinkedHashSet<>(contexts));
        }
        task.updateTimestamp();
    }

    /** Construye una entidad nueva a partir de este payload. */
    public Task toEntity() {
        Task task = new Task();
        applyTo(task);
        return task;
    }
}