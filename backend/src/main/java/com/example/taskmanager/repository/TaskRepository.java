package com.example.taskmanager.repository;

import com.example.taskmanager.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {
    // Find tasks by completion status
    List<Task> findByCompleted(boolean completed);

    // Find tasks by user ID
    List<Task> findByUserId(Long userId);
}