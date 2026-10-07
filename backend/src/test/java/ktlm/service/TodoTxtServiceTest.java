package ktlm.service;

import ktlm.model.Task;
import ktlm.repository.TaskRepository;
import ktlm.todotxt.TodoTxtCodec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * What matters here is identity: a uid identifies a row, and the file may carry the same
 * uid on more than one line when tuxedo generates the next instance of a recurring task.
 *
 * <p>The {@link TodoStore} goes against a real temporary directory: the interesting
 * behavior —atomic writing, inbox emptied before importing— belongs to the filesystem,
 * and a simulated store would test none of that.
 */
@ExtendWith(MockitoExtension.class)
class TodoTxtServiceTest {

    private static final Long USER = 7L;

    @Mock
    private TaskRepository taskRepository;

    @Mock
    private ApplicationEventPublisher events;

    private TodoTxtService service;
    private TodoStore store;

    /**
     * Watcher double: it does not look at the disk, but it records that the change is
     * ours. The real watcher is tested separately, against a temporary directory.
     */
    private final class RecordingWatcher extends TodoFileWatcher {
        RecordingWatcher(TodoStore store) {
            super(store, events);
        }

        @Override
        public void recordWritten(Long userId, String content) {
            written.add(TodoStore.hashOf(content));
        }

        @Override
        public void watch(Long userId) {
            // no need to watch anything in a service test
        }
    }

    private final List<String> written = new ArrayList<>();
    /** By id and not in a list: the importer saves twice and the double has to reproduce
     *  that, not count the same row twice. */
    private final Map<Long, Task> rows = new LinkedHashMap<>();
    private long nextId = 100;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        store = new TodoStore(tempDir.toString());
        TodoFileWatcher watcher = new RecordingWatcher(store);
        service = new TodoTxtService(taskRepository, new TodoTxtCodec(), events, store, watcher);
        rows.clear();
        nextId = 100;
        behaveLikeADatabase();
    }

    /** Simulates the in-memory repository: resolves ids and searches by uid like the table would. */
    private void behaveLikeADatabase() {
        lenient()
                .when(taskRepository.save(any(Task.class)))
                .thenAnswer(invocation -> {
                    Task task = invocation.getArgument(0);
                    if (task.getId() == null) {
                        task.setId(nextId++);
                    }
                    rows.put(task.getId(), task);
                    return task;
                });
        lenient()
                .when(taskRepository.findByUserIdAndTodoUid(anyLong(), any()))
                .thenAnswer(invocation -> {
                    String uid = invocation.getArgument(1);
                    return rows.values().stream().filter(t -> uid.equals(t.getTodoUid())).findFirst();
                });
        lenient()
                .when(taskRepository.findByUserIdAndCompletedOrderBySortOrderAscIdAsc(anyLong(), anyBoolean()))
                .thenAnswer(invocation -> {
                    boolean completed = invocation.getArgument(1);
                    return rows.values().stream().filter(t -> t.isCompleted() == completed).toList();
                });
        // The candidates for content matching: what is there right now.
        lenient()
                .when(taskRepository.findByUserId(anyLong()))
                .thenAnswer(invocation -> new ArrayList<>(rows.values()));
        lenient()
                .when(taskRepository.findByUserIdOrderBySortOrderAscIdAsc(anyLong()))
                .thenAnswer(invocation -> {
                    List<Task> out = new ArrayList<>(rows.values());
                    out.sort((a, b) -> {
                        int byOrder = Integer.compare(a.getSortOrder(), b.getSortOrder());
                        return byOrder != 0 ? byOrder : Long.compare(a.getId(), b.getId());
                    });
                    return out;
                });
    }

    private Task seed(String uid, String title) {
        Task task = new Task(title, null);
        task.setId(nextId++);
        task.setUserId(USER);
        task.setTodoUid(uid);
        rows.put(task.getId(), task);
        return task;
    }

    private Path todoFile() {
        return tempDir.resolve(String.valueOf(USER)).resolve("todo.txt");
    }

    @Test
    void importFile_AssignsAUidToEveryNewTask() {
        TodoTxtService.ImportResult result = service.importFile(USER, "Buy milk\nCall mom\n");

        assertEquals(2, result.imported());
        assertEquals(0, result.updated());
        assertTrue(rows.values().stream().allMatch(t -> t.getTodoUid() != null));
        assertEquals(rows.size(), rows.values().stream().map(Task::getTodoUid).distinct().count());
    }

    @Test
    void importFile_UpdatesByUidInsteadOfDuplicating() {
        seed("5", "Buy milk");

        TodoTxtService.ImportResult result = service.importFile(USER, "Buy oat milk uid:5\n");

        assertEquals(0, result.imported());
        assertEquals(1, result.updated());
        assertEquals(1, rows.size());
        assertEquals("Buy oat milk", rows.values().iterator().next().getTitle());
    }

    @Test
    void importFile_RepeatedUidOnTwoLines_CreatesTheSecondOneInsteadOfOverwriting() {
        seed("1", "Pay rent");

        // This is what tuxedo writes when completing a recurring task: same uid on both lines.
        TodoTxtService.ImportResult result = service.importFile(USER,
                "x 2026-10-05 2026-05-09 Pay rent rec:+1m uid:1\n" +
                "2026-10-05 Pay rent rec:+1m uid:1\n");

        assertEquals(1, result.imported());
        assertEquals(1, result.updated());
        assertEquals(2, rows.size());
        assertEquals(2, rows.values().stream().map(Task::getTodoUid).distinct().count());
        assertEquals(1, rows.values().stream().filter(Task::isCompleted).count());
        assertEquals(1, rows.values().stream().filter(t -> !t.isCompleted()).count());
    }

    @Test
    void importFile_LineaSinUid_ReconoceLaTareaPorContenido() {
        seed("7", "Tarea externa");

        // Tuxedo writes without uid if the file does not carry one yet. This used to duplicate.
        TodoTxtService.ImportResult result = service.importFile(USER, "Tarea externa\n");

        assertEquals(0, result.imported());
        assertEquals(1, result.updated());
        assertEquals(1, rows.size());
    }

    @Test
    void importFile_DosLineasIgualesSinUid_NoAdivinaYConservaAmbas() {
        service.importFile(USER, "Repetida\nRepetida\n");

        assertEquals(2, rows.size());
    }

    @Test
    void export_SaleDelArchivoYNoDeLaBase() {
        store.write(USER, "# cabecera que solo vive en el archivo\n");

        // The header and the exact format are not rebuilt from the table: they are
        // lost, and with them the columns nobody stored.
        assertTrue(service.export(USER).startsWith("# cabecera"));
    }

    @Test
    void importFile_EscribeElArchivoReconciliadoEnDisco() {
        service.importFile(USER, "Buy milk\n");

        String enDisco = store.read(USER);
        assertTrue(enDisco.contains("Buy milk"));
        assertTrue(enDisco.contains("uid:"));
    }

    @Test
    void archive_EscribeDoneTxtDeVerdad() {
        seed("1", "Done thing").setCompleted(true);
        seed("2", "Pendiente");

        TodoTxtService.ArchiveResult result = service.archive(USER);

        assertEquals(1, result.archived());
        assertTrue(store.readDone(USER).contains("Done thing"));
        List<String> hechas = store.readDoneLines(USER);
        assertEquals(1, hechas.size());
        assertTrue(hechas.get(0).contains("Done thing"));
        assertTrue(hechas.get(0).startsWith("x "));
    }

    @Test
    void drainInbox_ImportaYVaciaElArchivo() {
        store.writeInbox(USER, "Refill prescription\n");

        String archivo = service.drainInbox(USER);

        assertTrue(archivo.contains("Refill prescription"));
        assertEquals(1, rows.size(), rows.toString());
        // Emptying it BEFORE importing is what avoids reprocessing on every pass.
        assertTrue(store.readInboxLines(USER).isEmpty());
    }

    @Test
    void drainInbox_SinNadaQueDrenar_NoImporta() {
        long antes = rows.size();

        service.drainInbox(USER);

        assertEquals(antes, rows.size());
    }

    @Test
    void drainInbox_IgnoraComentariosYLineasVacias() {
        store.writeInbox(USER, "# no es una tarea\n\n   \nUna real\n");

        service.drainInbox(USER);

        assertEquals(1, rows.size());
        assertEquals("Una real", rows.values().iterator().next().getTitle());
    }

    @Test
    void appendInbox_AcumulaLineas() {
        service.appendInbox(USER, "Una");
        service.appendInbox(USER, "Otra");

        assertEquals(List.of("Una", "Otra"), store.readInboxLines(USER));
    }

    @Test
    void ensureFile_CreaElArchivoSoloLaPrimeraVez() {
        service.ensureFile(USER);
        assertTrue(Files.exists(todoFile()));

        store.write(USER, "2026-01-01 algo\n");
        service.ensureFile(USER);
        assertEquals("2026-01-01 algo\n", store.read(USER));
    }

    @Test
    void hash_CambiaSoloSiCambiaElArchivo() {
        store.write(USER, "uno\n");
        String a = store.hash(USER);

        store.write(USER, "uno\n");
        assertEquals(a, store.hash(USER));

        store.write(USER, "dos\n");
        assertNotEquals(a, store.hash(USER));
    }

    @Test
    void laEscrituraEsAtomica_NoDejaTemporales() {
        service.importFile(USER, "Buy milk\n");

        try (var archivos = Files.list(store.directoryFor(USER))) {
            assertTrue(archivos.noneMatch(nombre -> nombre.toString().endsWith(".tmp")));
        } catch (java.io.IOException e) {
            throw new AssertionError(e);
        }
    }

    @Test
    void unUsuarioNoLeeElArchivoDeOtro() {
        store.write(7L, "privado de siete\n");

        assertTrue(store.read(8L).isEmpty());
        assertFalse(store.read(8L).contains("privado"));
    }

    @Test
    void elArchivoConservaLosComentariosDelUsuario() throws Exception {
        Files.createDirectories(store.directoryFor(USER));
        Files.writeString(todoFile(),
                "# Mi lista\n\n2026-01-01 algo uid:5\n",
                StandardCharsets.UTF_8);
        seed("5", "algo");

        TodoTxtService.ImportResult result = service.importFile(USER, store.read(USER));

        assertTrue(result.file().contains("uid:5"));
    }
}