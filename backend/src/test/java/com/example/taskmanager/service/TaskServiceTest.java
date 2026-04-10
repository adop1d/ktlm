package com.example.taskmanager.service;

import com.example.taskmanager.model.Task;
import com.example.taskmanager.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private TaskService taskService;

    private Task sampleTask;

    @BeforeEach
    void setUp() {
        sampleTask = new Task("Sample Task", "This is a sample task");
        sampleTask.setId(1L);
        sampleTask.setCompleted(false);
    }

    @Test
    void getAllTasks_ShouldReturnAllTasks() {
        // Arrange
        when(taskRepository.findAll()).thenReturn(Arrays.asList(sampleTask));

        // Act
        List<Task> tasks = taskService.getAllTasks();

        // Assert
        assertFalse(tasks.isEmpty());
        assertEquals(1, tasks.size());
        assertEquals("Sample Task", tasks.get(0).getTitle());
        verify(taskRepository, times(1)).findAll();
    }

    @Test
    void getTaskById_WithExistingId_ShouldReturnTask() {
        // Arrange
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));

        // Act
        Optional<Task> task = taskService.getTaskById(1L);

        // Assert
        assertTrue(task.isPresent());
        assertEquals("Sample Task", task.get().getTitle());
        verify(taskRepository, times(1)).findById(1L);
    }

    @Test
    void getTaskById_WithNonExistingId_ShouldReturnEmpty() {
        // Arrange
        when(taskRepository.findById(999L)).thenReturn(Optional.empty());

        // Act
        Optional<Task> task = taskService.getTaskById(999L);

        // Assert
        assertTrue(task.isEmpty());
        verify(taskRepository, times(1)).findById(999L);
    }

    @Test
    void createTask_ShouldSaveAndReturnTask() {
        // Arrange
        when(taskRepository.save(any(Task.class))).thenReturn(sampleTask);

        // Act
        Task result = taskService.createTask(sampleTask);

        // Assert
        assertNotNull(result);
        assertEquals("Sample Task", result.getTitle());
        verify(taskRepository, times(1)).save(sampleTask);
    }

    @Test
    void updateTask_WithExistingId_ShouldUpdateAndReturnTask() {
        // Arrange
        Task updatedTask = new Task("Updated Task", "This task has been updated");
        updatedTask.setId(1L);
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(taskRepository.save(any(Task.class))).thenReturn(updatedTask);

        // Act
        Task result = taskService.updateTask(1L, updatedTask);

        // Assert
        assertNotNull(result);
        assertEquals("Updated Task", result.getTitle());
        assertEquals("This task has been updated", result.getDescription());
        verify(taskRepository, times(1)).findById(1L);
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    void updateTask_WithNonExistingId_ShouldThrowException() {
        // Arrange
        when(taskRepository.findById(999L)).thenReturn(Optional.empty());

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            taskService.updateTask(999L, new Task());
        });
        assertEquals("Task not found with id: 999", exception.getMessage());
        verify(taskRepository, times(1)).findById(999L);
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    void deleteTask_WithExistingId_ShouldDeleteTask() {
        // Arrange
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        doNothing().when(taskRepository).delete(any(Task.class));

        // Act
        taskService.deleteTask(1L);

        // Assert
        verify(taskRepository, times(1)).findById(1L);
        verify(taskRepository, times(1)).delete(sampleTask);
    }

    @Test
    void deleteTask_WithNonExistingId_ShouldThrowException() {
        // Arrange
        when(taskRepository.findById(999L)).thenReturn(Optional.empty());

        // Act & Assert
        RuntimeException exception = assertThrows(RuntimeException.class, () -> {
            taskService.deleteTask(999L);
        });
        assertEquals("Task not found with id: 999", exception.getMessage());
        verify(taskRepository, times(1)).findById(999L);
        verify(taskRepository, never()).delete(any(Task.class));
    }

    @Test
    void toggleTaskCompletion_ShouldToggleAndReturnTask() {
        // Arrange
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(taskRepository.save(any(Task.class))).thenReturn(sampleTask);

        // Act
        Task result = taskService.toggleTaskCompletion(1L);

        // Assert
        assertNotNull(result);
        assertTrue(result.isCompleted());
        verify(taskRepository, times(1)).findById(1L);
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    void getTasksByCompletionStatus_ShouldReturnFilteredTasks() {
        // Arrange
        Task completedTask = new Task("Completed Task", "This task is done");
        completedTask.setId(1L);
        completedTask.setCompleted(true);
        
        when(taskRepository.findByCompleted(true)).thenReturn(Arrays.asList(completedTask));

        // Act
        List<Task> tasks = taskService.getTasksByCompletionStatus(true);

        // Assert
        assertFalse(tasks.isEmpty());
        assertEquals(1, tasks.size());
        assertTrue(tasks.get(0).isCompleted());
        verify(taskRepository, times(1)).findByCompleted(true);
    }
}