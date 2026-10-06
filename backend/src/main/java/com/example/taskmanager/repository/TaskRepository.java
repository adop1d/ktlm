package com.example.taskmanager.repository;

import com.example.taskmanager.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    List<Task> findByUserId(Long userId);

    /** Scoped por propietario: una tarea de otro usuario es indistinguible de "no existe". */
    Optional<Task> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);

    long countByUserIdAndCompleted(Long userId, boolean completed);

    // --- Interoperabilidad con todo.txt -------------------------------------------------

    /** Una tarea de otro usuario es indistinguible de "no existe". */
    Optional<Task> findByUserIdAndTodoUid(Long userId, String todoUid);

    Optional<Task> findByTodoUid(String todoUid);

    /** Orden de archivo: sortOrder primero, id como desempate estable. */
    List<Task> findByUserIdOrderBySortOrderAscIdAsc(Long userId);

    List<Task> findByUserIdAndCompletedOrderBySortOrderAscIdAsc(Long userId, boolean completed);
}