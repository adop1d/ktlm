package com.example.taskmanager.service;

import com.example.taskmanager.model.Task;
import com.example.taskmanager.repository.TaskRepository;
import com.example.taskmanager.todotxt.TodoTxtCodec;
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
 * Lo que importa aquí es la identidad: un uid identifica una fila, y el archivo puede
 * llevar el mismo uid en más de una línea cuando tuxedo genera la instancia siguiente de
 * una recurrente.
 *
 * <p>El {@link TodoStore} va de verdad contra un directorio temporal: el comportamiento
 * interesante —escritura atómica, inbox que se vacía antes de importar— es del sistema de
 * archivos, y un store simulado no probaría nada de eso.
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
    /** Por id y no en una lista: el importador guarda dos veces y el doble tiene que
     *  reproducirlo, no contar dos veces la misma fila. */
    private final Map<Long, Task> rows = new LinkedHashMap<>();
    private long nextId = 100;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        store = new TodoStore(tempDir.toString());
        service = new TodoTxtService(taskRepository, new TodoTxtCodec(), events, store);
        rows.clear();
        nextId = 100;
        behaveLikeADatabase();
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
        // Los candidatos del emparejamiento por contenido: lo que hay ahora mismo.
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

        // Es lo que escribe tuxedo al completar una recurrente: misma uid en las dos líneas.
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

        // Tuxedo escribe sin uid si el archivo aún no lo lleva. Antes esto duplicaba.
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

        // La cabecera y el formato exacto no se reconstructen desde la tabla: se pierden, y
        // con ellos las columnas que nadie guardó.
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
        // Vaciarlo ANTES de importar es lo que evita reprocesar en cada pasada.
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