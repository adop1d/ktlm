package com.example.taskmanager.dto;

import com.example.taskmanager.model.Task;
import org.springframework.data.domain.Page;

import java.util.List;

/** Una página de tareas, con los metadatos que el cliente necesita para paginar. */
public record TaskPageResponse(
        List<TaskResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious) {

    public static TaskPageResponse from(Page<Task> result) {
        return new TaskPageResponse(
                result.getContent().stream().map(TaskResponse::from).toList(),
                result.getNumber(),
                result.getSize(),
                result.getTotalElements(),
                result.getTotalPages(),
                result.hasNext(),
                result.hasPrevious());
    }
}