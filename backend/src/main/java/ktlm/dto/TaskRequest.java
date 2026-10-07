package ktlm.dto;

import ktlm.model.Task;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;

/**
 * Write payload for a task. Deliberately does NOT expose id, userId, createdAt,
 * updatedAt or todoUid: the server sets the identity and the timestamps.
 *
 * <p>The title is optional because the same payload serves a partial PUT —reordering
 * the file only sends `sortOrder`— and a POST. Required-ness is enforced by the
 * service on create, which is where it actually matters.
 */
public record TaskRequest(
        @Size(max = 500, message = "Title must not exceed 500 characters")
        String title,

        @Size(max = 4000, message = "Description must not exceed 4000 characters")
        String description,

        Boolean completed,

        Task.Priority priority,

        LocalDate dueDate,

        LocalDate startDate,

        Integer sortOrder,

        String recurrence,

        String threshold,

        String note,

        List<String> projects,

        List<String> contexts) {

    /** Applies this payload onto an existing entity. Absent fields are kept. */
    public void applyTo(Task task) {
        if (title != null) {
            task.setTitle(title.trim());
        }
        if (description != null) {
            task.setDescription(description.isBlank() ? null : description);
        }
        if (completed != null) {
            task.setCompleted(completed);
            // The completion date follows the state, the client does not set it.
            task.setCompletedAt(completed ? LocalDateTime.now() : null);
        }
        if (priority != null) {
            task.setPriority(priority);
        }
        if (dueDate != null) {
            task.setDueDate(dueDate);
        }
        if (startDate != null) {
            task.setStartDate(startDate);
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
        if (note != null) {
            task.setNote(note.isBlank() ? null : note.trim());
        }
        if (projects != null) {
            task.setProjects(new LinkedHashSet<>(projects));
        }
        if (contexts != null) {
            task.setContexts(new LinkedHashSet<>(contexts));
        }
        task.updateTimestamp();
    }

    /** Builds a new entity from this payload. */
    public Task toEntity() {
        Task task = new Task();
        applyTo(task);
        return task;
    }
}