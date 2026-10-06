package com.example.taskmanager.dto;

import com.example.taskmanager.model.Task;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Payload de escritura de una tarea. Deliberadamente NO expone id, userId, createdAt,
 * updatedAt ni todoUid: la identidad y las marcas de tiempo las fija el servidor.
 *
 * <p>El título es opcional porque el mismo payload sirve para un PUT parcial y para un POST.
 * La obligatoriedad la impone el servicio al crear, que es donde de verdad importa.
 */
public record TaskRequest(
        @Size(max = 500, message = "Title must not exceed 500 characters")
        String title,

        @Size(max = 4000, message = "Description must not exceed 4000 characters")
        String description,

        Boolean completed,

        Task.Priority priority,

        LocalDate dueDate,

        Integer sortOrder) {

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
        task.updateTimestamp();
    }

    /** Construye una entidad nueva a partir de este payload. */
    public Task toEntity() {
        Task task = new Task();
        applyTo(task);
        return task;
    }
}