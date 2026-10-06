package com.example.taskmanager.service;

import com.example.taskmanager.dto.TaskCounts;
import com.example.taskmanager.dto.TaskPageResponse;
import com.example.taskmanager.dto.TaskRequest;
import com.example.taskmanager.exception.InvalidRequestException;
import com.example.taskmanager.exception.ResourceNotFoundException;
import com.example.taskmanager.model.Task;
import com.example.taskmanager.model.TaskFilter;
import com.example.taskmanager.model.TaskSort;
import com.example.taskmanager.repository.TaskRepository;
import org.springframework.context.ApplicationEventPublisher;
import com.example.taskmanager.repository.TaskSpecifications;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

    /** Tope duro del tamaño de página, para que un size=100000 no arrastre la tabla. */
    static final int MAX_PAGE_SIZE = 200;

    private final TaskRepository taskRepository;
    private final ApplicationEventPublisher events;

    public TaskService(TaskRepository taskRepository, ApplicationEventPublisher events) {
        this.taskRepository = taskRepository;
        this.events = events;
    }

    /**
     * Avisa a las sesiones abiertas de este usuario. Se emite dentro de la transacción,
     * pero el oyente de TaskEventStream espera al commit antes de empujar el evento.
     */
    private void notifyChanged(Long userId) {
        events.publishEvent(new TaskEventStream.TasksChanged(userId));
    }

    /**
     * Una página de las tareas del usuario. El scope por usuario va incluido en la
     * specification: no hay forma de pedir la lista sin él.
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

        // Pageable.unpaged: el orden lo pone la specification, no un Sort.
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
        // El payload admite títulos ausentes para los PUT parciales, pero una tarea sí
        // nace con título.
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
     * Aplica un parche parcial. Los campos ausentes del payload se conservan, de modo que
     * priority, dueDate y sortOrder sobreviven a un PUT que solo trae title/description.
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