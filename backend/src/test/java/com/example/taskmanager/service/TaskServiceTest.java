package com.example.taskmanager.service;

import com.example.taskmanager.dto.TaskCounts;
import com.example.taskmanager.dto.TaskPageResponse;
import com.example.taskmanager.dto.TaskRequest;
import com.example.taskmanager.exception.ResourceNotFoundException;
import com.example.taskmanager.model.Task;
import com.example.taskmanager.model.TaskFilter;
import com.example.taskmanager.model.TaskSort;
import com.example.taskmanager.repository.TaskRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.springframework.context.ApplicationEventPublisher;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    private static final Long OWNER = 7L;
    private static final Long OTHER = 8L;

    @Mock
    private TaskRepository taskRepository;

    /** Los eventos son un efecto secundario: se comprueban aparte, no ensucian estas pruebas. */
    @Mock
    private ApplicationEventPublisher events;

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

    @Test
    void getTasks_ReturnsThePageAndItsMetadata() {
        when(taskRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(sampleTask), PageRequest.of(1, 20), 137));

        TaskPageResponse page = taskService.getTasks(OWNER, 1, 20, TaskFilter.ALL, null, null, null, TaskSort.FILE);

        assertEquals(1, page.content().size());
        assertEquals(1, page.page());
        assertEquals(20, page.size());
        assertEquals(137, page.totalElements());
        assertEquals(7, page.totalPages());
        assertTrue(page.hasNext());
        assertTrue(page.hasPrevious());
    }

    @Test
    void getTasks_CapsThePageSizeSoARequestCannotDrainTheTable() {
        when(taskRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(Page.empty());

        taskService.getTasks(OWNER, 0, 100_000, TaskFilter.ALL, null, null, null, TaskSort.FILE);

        var captor = ArgumentCaptor.forClass(Pageable.class);
        verify(taskRepository).findAll(any(Specification.class), captor.capture());
        assertEquals(TaskService.MAX_PAGE_SIZE, captor.getValue().getPageSize());
    }

    @Test
    void getTasks_ClampsNegativePageAndSize() {
        when(taskRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(Page.empty());

        taskService.getTasks(OWNER, -5, 0, TaskFilter.ALL, null, null, null, TaskSort.FILE);

        var captor = ArgumentCaptor.forClass(Pageable.class);
        verify(taskRepository).findAll(any(Specification.class), captor.capture());
        assertEquals(0, captor.getValue().getPageNumber());
        assertEquals(20, captor.getValue().getPageSize());
    }

    @Test
    void getCounts_SplitsActiveAndCompleted() {
        when(taskRepository.countByUserId(OWNER)).thenReturn(10L);
        when(taskRepository.countByUserIdAndCompleted(OWNER, true)).thenReturn(4L);

        TaskCounts counts = taskService.getCounts(OWNER);

        assertEquals(10, counts.all());
        assertEquals(6, counts.active());
        assertEquals(4, counts.completed());
    }
}