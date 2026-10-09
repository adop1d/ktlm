package ktm.repository;

import ktm.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    List<Task> findByUserId(Long userId);

    /** Scoped by owner: another user's task is indistinguishable from "does not exist". */
    Optional<Task> findByIdAndUserId(Long id, Long userId);

    long countByUserId(Long userId);

    long countByUserIdAndCompleted(Long userId, boolean completed);

    // --- todo.txt interoperability ----------------------------------------------------

    /** Another user's task is indistinguishable from "does not exist". */
    Optional<Task> findByUserIdAndTodoUid(Long userId, String todoUid);

    Optional<Task> findByTodoUid(String todoUid);

    /** File order: sortOrder first, id as a stable tiebreaker. */
    List<Task> findByUserIdOrderBySortOrderAscIdAsc(Long userId);

    List<Task> findByUserIdAndCompletedOrderBySortOrderAscIdAsc(Long userId, boolean completed);
}