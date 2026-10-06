package com.example.taskmanager.service;

import com.example.taskmanager.model.Task;
import com.example.taskmanager.repository.TaskRepository;
import com.example.taskmanager.todotxt.TodoTxtCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Lo que importa aquí es la identidad: un uid identifica una fila, y el archivo puede
 * llevar el mismo uid en más de una línea cuando tuxedo genera la instancia siguiente de
 * una recurrente.
 */
@ExtendWith(MockitoExtension.class)
class TodoTxtServiceTest {

    private static final Long USER = 7L;

    @Mock
    private TaskRepository taskRepository;

    private TodoTxtService service;
    private final List<Task> rows = new ArrayList<>();
    private long nextId = 100;

    @BeforeEach
    void setUp() {
        service = new TodoTxtService(taskRepository, new TodoTxtCodec());
        rows.clear();
        nextId = 100;
    }

    /** Simula el repository en memoria: resuelve ids y busca por uid como haría la tabla. */
    private void behaveLikeADatabase() {
        lenient()
                .when(taskRepository.save(any(Task.class)))
                .thenAnswer(invocation -> {
                    Task task = invocation.getArgument(0);
                    if (task.getId() == null) {
                        task.setId(nextId++);
                    }
                    rows.removeIf((existing) -> existing.getId().equals(task.getId()));
                    rows.add(task);
                    return task;
                });
        lenient()
                .when(taskRepository.findByUserId(anyLong()))
                .thenAnswer(invocation -> new ArrayList<>(rows));
        lenient()
                .when(taskRepository.findByUserIdAndTodoUid(anyLong(), any()))
                .thenAnswer(invocation -> {
                    String uid = invocation.getArgument(1);
                    return rows.stream().filter(t -> uid.equals(t.getTodoUid())).findFirst();
                });
        lenient()
                .when(taskRepository.findByUserIdOrderBySortOrderAscIdAsc(anyLong()))
                .thenAnswer(invocation -> {
                    List<Task> out = new ArrayList<>(rows);
                    out.sort((a, b) -> {
                        int byOrder = Integer.compare(a.getSortOrder(), b.getSortOrder());
                        return byOrder != 0 ? byOrder : Long.compare(a.getId(), b.getId());
                    });
                    return out;
                });
        lenient()
                .when(taskRepository.findByUserIdAndCompletedOrderBySortOrderAscIdAsc(anyLong(), anyBoolean()))
                .thenAnswer(invocation -> {
                    boolean completed = invocation.getArgument(1);
                    return rows.stream().filter(t -> t.isCompleted() == completed).toList();
                });
    }

    private void stubCompletedQuery() {
        lenient()
                .when(taskRepository.findByUserIdAndCompletedOrderBySortOrderAscIdAsc(anyLong(), anyBoolean()))
                .thenAnswer(invocation -> {
                    boolean completed = invocation.getArgument(1);
                    return rows.stream().filter(t -> t.isCompleted() == completed).toList();
                });
    }

    /** Una fila ya presente, como si estuviera en la base de una ejecución anterior. */
    private Task seed(String uid, String title) {
        Task task = new Task(title, null);
        task.setId(nextId++);
        task.setUserId(USER);
        task.setTodoUid(uid);
        rows.add(task);
        return task;
    }

    @Test
    void importFile_AssignsAUidToEveryNewTask() {
        behaveLikeADatabase();

        TodoTxtService.ImportResult result = service.importFile(USER, "Buy milk\nCall mom\n");

        assertEquals(2, result.imported());
        assertEquals(0, result.updated());
        assertTrue(rows.stream().allMatch(t -> t.getTodoUid() != null));
        assertEquals(rows.size(), rows.stream().map(Task::getTodoUid).distinct().count());
    }

    @Test
    void importFile_UpdatesByUidInsteadOfDuplicating() {
        behaveLikeADatabase();
        seed("5", "Buy milk");

        TodoTxtService.ImportResult result = service.importFile(USER, "Buy oat milk uid:5\n");

        assertEquals(0, result.imported());
        assertEquals(1, result.updated());
        assertEquals(1, rows.size());
        assertEquals("Buy oat milk", rows.get(0).getTitle());
    }

    @Test
    void importFile_RepeatedUidOnTwoLines_CreatesTheSecondOneInsteadOfOverwriting() {
        behaveLikeADatabase();
        seed("1", "Pay rent");

        // Es lo que escribe tuxedo al completar una recurrente: misma uid en las dos líneas.
        TodoTxtService.ImportResult result = service.importFile(USER,
                "x 2026-10-05 2026-05-09 Pay rent rec:+1m uid:1\n" +
                "2026-10-05 Pay rent rec:+1m uid:1\n");

        assertEquals(1, result.imported());
        assertEquals(1, result.updated());
        assertEquals(2, rows.size());
        assertEquals(2, rows.stream().map(Task::getTodoUid).distinct().count());
        assertEquals(1, rows.stream().filter(Task::isCompleted).count());
        assertEquals(1, rows.stream().filter(t -> !t.isCompleted()).count());
    }

    @Test
    void importFile_LineaSinUid_ReconoceLaTareaPorContenido() {
        behaveLikeADatabase();
        seed("7", "Tarea externa");

        // Tuxedo escribe sin uid si el archivo aún no lo lleva. Antes esto duplicaba la tarea.
        TodoTxtService.ImportResult result = service.importFile(USER, "Tarea externa\n");

        assertEquals(0, result.imported());
        assertEquals(1, result.updated());
        assertEquals(1, rows.size());
    }

    @Test
    void importFile_DosLineasIgualesSinUid_NoAdivinaYConservaAmbas() {
        behaveLikeADatabase();
        service.importFile(USER, "Repetida\nRepetida\n");

        // Dos tareas idénticas son indistinguibles: el emparejamiento debe abstain.
        assertEquals(2, rows.size());
    }

    @Test
    void export_WritesTheReconciledFileBack() {
        behaveLikeADatabase();

        // export() se llama dentro de importFile, así que primero no hay nada que exportar.
        assertTrue(service.export(USER).isEmpty());

        service.importFile(USER, "(A) 2026-04-28 Call dentist +health due:2026-05-08\n");
        String exported = service.export(USER);

        assertTrue(exported.contains("uid:"), "el export debe llevar los uid de vuelta al archivo");
        assertTrue(exported.contains("(A)"));
        assertTrue(exported.contains("+health"));
        assertTrue(exported.contains("due:2026-05-08"));
    }

    @Test
    void importFile_NeverDeletesTasksAbsentFromTheFile() {
        behaveLikeADatabase();
        service.importFile(USER, "Una\nDos\n");
        String withUids = service.export(USER);
        String onlyOne = withUids.lines().filter((line) -> line.contains("Una")).findFirst().orElseThrow();

        service.importFile(USER, onlyOne + "\n");

        assertEquals(2, rows.size());
    }

    @Test
    void archive_RemovesCompletedAndReturnsTheDoneFile() {
        behaveLikeADatabase();
        stubCompletedQuery();
        seed("1", "Done thing").setCompleted(true);
        seed("2", "Pendiente");

        TodoTxtService.ArchiveResult result = service.archive(USER);

        assertEquals(1, result.archived());
        assertTrue(result.doneFile().startsWith("x "));
        assertTrue(result.doneFile().contains("Done thing"));
        verify(taskRepository).deleteAll(any());
    }
}