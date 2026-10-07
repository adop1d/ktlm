package ktlm.service;

import ktlm.dto.TaskCounts;
import ktlm.dto.TaskPageResponse;
import ktlm.dto.TaskRequest;
import ktlm.exception.InvalidRequestException;
import ktlm.exception.ResourceNotFoundException;
import ktlm.model.Task;
import ktlm.model.TaskFilter;
import ktlm.model.TaskSort;
import ktlm.repository.TaskRepository;
import org.springframework.context.ApplicationEventPublisher;
import ktlm.repository.TaskSpecifications;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

    /** Hard cap on the page size, so a size=100000 does not drag the whole table in. */
    static final int MAX_PAGE_SIZE = 200;

    private final TaskRepository taskRepository;
    private final ApplicationEventPublisher events;

    public TaskService(TaskRepository taskRepository, ApplicationEventPublisher events) {
        this.taskRepository = taskRepository;
        this.events = events;
    }

    /**
     * Notifies this user's open sessions. It is published inside the transaction,
     * but the TaskEventStream listener waits for the commit before pushing the event.
     */
    private void notifyChanged(Long userId) {
        events.publishEvent(new TaskEventStream.TasksChanged(userId));
    }

    /**
     * A page of the user's tasks. The per-user scope is built into the
     * specification: there is no way to ask for the list without it.
     */
    public TaskPageResponse getTasks(Long userId, int page, int size, TaskFilter filter, String q,
                                     String project, String context, TaskSort sort) {
        int safeSize = size <= 0 ? 20 : Math.min(size, MAX_PAGE_SIZE);
        int safePage = Math.max(page, 0);

        Specification<Task> spec = TaskSpecifications.allOf(
                TaskSpecifications.ownedBy(userId),
                TaskSpecifications.withFilter(filter),
                TaskSpecifications.matching(q),
                TaskSpecifications.inProject(project),
                TaskSpecifications.inContext(context),
                TaskSpecifications.sortedBy(sort));

        // Pageable.unpaged: the order comes from the specification, not from a Sort.
        var pageable = PageRequest.of(safePage, safeSize, Sort.unsorted());
        return TaskPageResponse.from(taskRepository.findAll(spec, pageable));
    }

    public TaskCounts getCounts(Long userId) {
        long all = taskRepository.countByUserId(userId);
        long completed = taskRepository.countByUserIdAndCompleted(userId, true);
        return new TaskCounts(all, all - completed, completed);
    }

    public List<Task> getAllTasksByUser(Long userId) {
        return taskRepository.findByUserId(userId);
    }

    public Optional<Task> getTaskById(Long id, Long userId) {
        return taskRepository.findByIdAndUserId(id, userId);
    }


    @Transactional
    public Task createTask(TaskRequest request, Long userId) {
        // The payload allows missing titles for partial PUTs, but a task is
        // born with a title.
        if (request.title() == null || request.title().isBlank()) {
            throw new InvalidRequestException("Title is required");
        }
        Task task = request.toEntity();
        task.setUserId(userId);
        Task saved = taskRepository.save(task);
        notifyChanged(userId);
        return saved;
    }

    /**
     * Applies a partial patch. Fields absent from the payload are kept, so
     * priority, dueDate and sortOrder survive a PUT that only brings title/description.
     */
    @Transactional
    public Task updateTask(Long id, Long userId, TaskRequest request) {
        Task task = requireOwned(id, userId);
        request.applyTo(task);
        Task saved = taskRepository.save(task);
        notifyChanged(userId);
        return saved;
    }

    @Transactional
    public void deleteTask(Long id, Long userId) {
        taskRepository.delete(requireOwned(id, userId));
        notifyChanged(userId);
    }

    @Transactional
    public Task toggleTaskCompletion(Long id, Long userId) {
        Task task = requireOwned(id, userId);
        task.setCompleted(!task.isCompleted());
        task.updateTimestamp();
        Task saved = taskRepository.save(task);
        notifyChanged(userId);
        return saved;
    }

    private Task requireOwned(Long id, Long userId) {
        return taskRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + id));
    }
}