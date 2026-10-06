package com.example.taskmanager.dto;

import com.example.taskmanager.model.Task;
import java.time.LocalDate;
import java.time.LocalDateTime;

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
        LocalDateTime updatedAt) {

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
                task.getUpdatedAt());
    }
}