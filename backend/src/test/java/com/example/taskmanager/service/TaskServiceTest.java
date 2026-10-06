package com.example.taskmanager.service;

import com.example.taskmanager.dto.TaskRequest;
import com.example.taskmanager.exception.ResourceNotFoundException;
import com.example.taskmanager.model.Task;
import com.example.taskmanager.repository.TaskRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    private static final Long OWNER = 7L;
    private static final Long OTHER = 8L;

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private TaskService taskService;

    private Task sampleTask;

    @BeforeEach
    void setUp() {
        sampleTask = new Task("Sample task", "A description");
        sampleTask.setId(1L);
        sampleTask.setUserId(OWNER);
    }

    @Test
    void getAllTasks_ShouldReturnAllTasks() {
        when(taskRepository.findByUserId(OWNER)).thenReturn(List.of(sampleTask));

        List<Task> result = taskService.getAllTasksByUser(OWNER);

        assertEquals(1, result.size());
        assertEquals("Sample task", result.get(0).getTitle());
    }

    @Test
    void getTaskById_WithExistingId_ShouldReturnTask() {
        when(taskRepository.findByIdAndUserId(1L, OWNER)).thenReturn(Optional.of(sampleTask));

        Optional<Task> result = taskService.getTaskById(1L, OWNER);

        assertTrue(result.isPresent());
        assertEquals(1L, result.get().getId());
    }

    @Test
    void getTaskById_WithNonExistingId_ShouldReturnEmpty() {
        when(taskRepository.findByIdAndUserId(99L, OWNER)).thenReturn(Optional.empty());

        assertTrue(taskService.getTaskById(99L, OWNER).isEmpty());
    }

    @Test
    void getTaskById_TaskOwnedBySomeoneElse_ShouldBeIndistinguishableFromMissing() {
        when(taskRepository.findByIdAndUserId(1L, OTHER)).thenReturn(Optional.empty());

        assertTrue(taskService.getTaskById(1L, OTHER).isEmpty());
    }

    @Test
    void createTask_ShouldStampOwnerAndPersist() {
        TaskRequest request = new TaskRequest("Buy milk", null, null, null, null, null, null, null, null, null);
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task created = taskService.createTask(request, OWNER);

        assertEquals(OWNER, created.getUserId());
        assertEquals("Buy milk", created.getTitle());
        assertEquals(Task.Priority.MEDIUM, created.getPriority());
        verify(taskRepository).save(any(Task.class));

    }

    @Test
    void updateTask_PartialPayload_ShouldPreservePriorityAndDueDate() {
        sampleTask.setPriority(Task.Priority.HIGH);
        sampleTask.setDueDate(LocalDate.of(2026, 12, 1));
        when(taskRepository.findByIdAndUserId(1L, OWNER)).thenReturn(Optional.of(sampleTask));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task updated = taskService.updateTask(
                1L, OWNER, new TaskRequest("Renamed", null, null, null, null, null, null, null, null, null));

        assertEquals("Renamed", updated.getTitle());
        assertEquals(Task.Priority.HIGH, updated.getPriority());
        assertEquals(LocalDate.of(2026, 12, 1), updated.getDueDate());
    }

    @Test
    void updateTask_ExplicitPayload_ShouldOverwriteEveryField() {
        when(taskRepository.findByIdAndUserId(1L, OWNER)).thenReturn(Optional.of(sampleTask));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task updated = taskService.updateTask(1L, OWNER,
                new TaskRequest("T", "D", true, Task.Priority.LOW, LocalDate.of(2027, 1, 2), 9, null, null, null, null));

        assertEquals(Task.Priority.LOW, updated.getPriority());
        assertEquals(LocalDate.of(2027, 1, 2), updated.getDueDate());
        assertEquals(9, updated.getSortOrder());
        assertTrue(updated.isCompleted());
    }

    @Test
    void updateTask_TaskOwnedBySomeoneElse_ShouldThrowNotFound() {
        when(taskRepository.findByIdAndUserId(1L, OTHER)).thenReturn(Optional.empty());

        ResourceNotFoundException ex = assertThrows(ResourceNotFoundException.class,
                () -> taskService.updateTask(1L, OTHER,
                        new TaskRequest("hijack", null, null, null, null, null, null, null, null, null)));

        assertTrue(ex.getMessage().contains("1"));
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void updateTask_WithNonExistingId_ShouldThrowException() {
        when(taskRepository.findByIdAndUserId(99L, OWNER)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () ->
                taskService.updateTask(99L, OWNER, new TaskRequest("x", null, null, null, null, null, null, null, null, null)));
    }

    @Test
    void deleteTask_WithExistingId_ShouldDeleteTask() {
        when(taskRepository.findByIdAndUserId(1L, OWNER)).thenReturn(Optional.of(sampleTask));

        taskService.deleteTask(1L, OWNER);

        verify(taskRepository).delete(sampleTask);
    }

    @Test
    void deleteTask_WithNonExistingId_ShouldThrowException() {
        when(taskRepository.findByIdAndUserId(99L, OWNER)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> taskService.deleteTask(99L, OWNER));
        verify(taskRepository, never()).delete(any(Task.class));
    }

    @Test
    void toggleTaskCompletion_ShouldToggleAndReturnTask() {
        when(taskRepository.findByIdAndUserId(1L, OWNER)).thenReturn(Optional.of(sampleTask));
        when(taskRepository.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));

        Task toggled = taskService.toggleTaskCompletion(1L, OWNER);
        assertTrue(toggled.isCompleted());

        Task toggledBack = taskService.toggleTaskCompletion(1L, OWNER);
        assertFalse(toggledBack.isCompleted());
    }

    @Test
    void toggleTaskCompletion_TaskOwnedBySomeoneElse_ShouldThrowNotFound() {
        when(taskRepository.findByIdAndUserId(1L, OTHER)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> taskService.toggleTaskCompletion(1L, OTHER));
    }

}