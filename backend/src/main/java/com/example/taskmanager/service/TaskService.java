package com.example.taskmanager.service;

import com.example.taskmanager.dto.TaskRequest;
import com.example.taskmanager.exception.InvalidRequestException;
import com.example.taskmanager.exception.ResourceNotFoundException;
import com.example.taskmanager.model.Task;
import com.example.taskmanager.repository.TaskRepository;
import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class TaskService {

    /** Tope duro del tamaño de página, para que un size=100000 no arrastre la tabla. */
    static final int MAX_PAGE_SIZE = 200;

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
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
        return taskRepository.save(task);
    }

    /**
     * Aplica un parche parcial. Los campos ausentes del payload se conservan, de modo que
     * priority, dueDate y sortOrder sobreviven a un PUT que solo trae title/description.
     */
    @Transactional
    public Task updateTask(Long id, Long userId, TaskRequest request) {
        Task task = requireOwned(id, userId);
        request.applyTo(task);
        return taskRepository.save(task);
    }

    @Transactional
    public void deleteTask(Long id, Long userId) {
        taskRepository.delete(requireOwned(id, userId));
    }

    @Transactional
    public Task toggleTaskCompletion(Long id, Long userId) {
        Task task = requireOwned(id, userId);
        task.setCompleted(!task.isCompleted());
        task.updateTimestamp();
        return taskRepository.save(task);
    }

    private Task requireOwned(Long id, Long userId) {
        return taskRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Task not found with id: " + id));
    }
}