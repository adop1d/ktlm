package ktlm.dto;

import ktlm.model.Task;
import org.springframework.data.domain.Page;

import java.util.List;

/** A page of tasks, with the metadata the client needs to paginate. */
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