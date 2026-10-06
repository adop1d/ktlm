package com.example.taskmanager.repository;

import com.example.taskmanager.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    List<Task> findByUserId(Long userId);

    List<Task> findByUserIdAndCompleted(Long userId, boolean completed);

    /** Scoped por propietario: una tarea de otro usuario es indistinguible de "no existe". */
    Optional<Task> findByIdAndUserId(Long id, Long userId);
}