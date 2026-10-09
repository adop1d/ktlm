package ktm.service;

import ktm.dto.TaskCounts;
import ktm.dto.TaskPageResponse;
import ktm.dto.TaskRequest;
import ktm.exception.InvalidRequestException;
import ktm.exception.ResourceNotFoundException;
import ktm.model.Task;
import ktm.model.TaskFilter;
import ktm.model.TaskSort;
import ktm.repository.TaskRepository;
import org.springframework.context.ApplicationEventPublisher;
import ktm.repository.TaskSpecifications;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

    /** Hard cap on the page size, so a size=100000 does not drag the whole table in. */
    static final int MAX_PAGE_SIZE = 200;

    private final TaskRepository taskRepository;
    private final ApplicationEventPublisher events;
    private final TodoTxtService todoTxt;

    public TaskService(
            TaskRepository taskRepository,
            ApplicationEventPublisher events,
            TodoTxtService todoTxt) {
        this.taskRepository = taskRepository;
        this.events = events;
        this.todoTxt = todoTxt;
    }

    /**
     * Notifies this user's open sessions. It is published inside the transaction,
     * but the TaskEventStream listener waits for the commit before pushing the event.
     *
     * <p>It also rewrites the file, after the commit rather than inside the transaction.
     * Every field the file cares about comes through here — the ones the browser patches in
     * its mirror and then PUTs, and also the ones it cannot reach from the mirror, like the
     * start date or a project typed into the edit form. Without this, a change made through
     * the REST API landed in the table and never showed up in the todo.txt, which is the
     * file everything else reads. Doing it here rather than in each caller means there is
     * one place to forget, and it is this one.
     */
    private void notifyChanged(Long userId) {
        events.publishEvent(new TaskEventStream.TasksChanged(userId));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    todoTxt.persistToFile(userId);
                }
            });
        } else {
            // No transaction to wait for. Still write the file: a caller outside one would
            // otherwise get a change that only exists in the table.
            todoTxt.persistToFile(userId);
        }
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