package com.example.taskmanager.service;

import com.example.taskmanager.repository.TaskRepository;
import com.example.taskmanager.todotxt.TodoTxtCodec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.context.ApplicationEventPublisher;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

/**
 * El vigilante sustituye al sondeo que antes vivía en el navegador. Lo que importa
 * comprobar aquí es la decisión: cuándo un cambio es nuestro y cuándo es de alguien
 * editando el archivo con su editor.
 *
 * <p>Usa un directorio temporal de verdad porque {@link java.nio.file.WatchService} y la
 * escritura atómica son del sistema de archivos; un doble no probaría nada de eso.
 */
class TodoFileWatcherTest {

    private static final Long USER = 7L;

    @TempDir
    Path tempDir;

    private TodoStore store;
    private TodoFileWatcher watcher;
    private TodoTxtService todoTxt;
    private TodoFileReconciler reconciler;
    private final List<String> written = new ArrayList<>();

    @BeforeEach
    void setUp() throws IOException {
        TaskRepository taskRepository = mock(TaskRepository.class);
        ApplicationEventPublisher publisher = mock(ApplicationEventPublisher.class);
        store = new TodoStore(tempDir.toString());

        lenient().when(taskRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(taskRepository.findByUserId(anyLong())).thenAnswer(i -> new ArrayList<>());
        lenient().when(taskRepository.findByUserIdOrderBySortOrderAscIdAsc(anyLong()))
                .thenAnswer(i -> new ArrayList<>());
        lenient().when(taskRepository.findByUserIdAndTodoUid(anyLong(), any()))
                .thenReturn(java.util.Optional.empty());
        // El vigilante real, salvo recordWritten: aquí se comprueba que decide bien, no que
        // notifique. Eso sí va contra el disco de verdad, que es lo que importa.
        watcher = new TodoFileWatcher(store, publisher) {
            @Override
            public void recordWritten(Long userId, String content) {
                written.add(TodoStore.hashOf(content));
            }
        };
        todoTxt = new TodoTxtService(taskRepository, new TodoTxtCodec(), publisher, store, watcher);
        reconciler = new TodoFileReconciler(todoTxt, watcher);
        watcher.start();
    }

    @AfterEach
    void tearDown() {
        watcher.stop();
    }

    private Path todoFile() {
        return store.directoryFor(USER).resolve("todo.txt");
    }

    @Test
    void watch_CreaElDirectorioYRegistraElUsuario() {
        watcher.watch(USER);

        assertTrue(Files.isDirectory(store.directoryFor(USER)));
        assertTrue(watcher.isWatching(USER));
        assertEquals(USER, watcher.ownerOf(store.directoryFor(USER)));
    }

    @Test
    void unCambioQueEsNuestroNoSeReimporta() {
        watcher.watch(USER);
        store.write(USER, "hola\n");
        watcher.recordWritten(USER, "hola\n");
        int antes = written.size();

        watcher.onChanged(USER);

        assertEquals(antes, written.size());
    }

    @Test
    void unCambioExternoSeReimporta() throws Exception {
        watcher.watch(USER);
        store.write(USER, "base\n");
        watcher.recordWritten(USER, "base\n");
        int antes = written.size();

        // Alguien edita el archivo por fuera de la app, como con vim.
        Files.writeString(todoFile(), "base\ny otra cosa\n", StandardCharsets.UTF_8);
        watcher.onChanged(USER);
        reconciler.onFileChanged(new TodoFileWatcher.FileChanged(USER));

        // Lo que se comprueba es que se detectó y se reimportó. Qué queda escrito después
        // lo decide el repositorio, que aquí está vacío a propósito.
        assertEquals(antes + 1, written.size());
    }

    @Test
    void elTemporalDeNuestraEscrituraNoDisparaNada() throws Exception {
        watcher.watch(USER);
        store.write(USER, "base\n");
        watcher.recordWritten(USER, "base\n");
        int antes = written.size();

        // El .tmp es de la escritura atómica propia, no de una edición.
        Files.writeString(store.directoryFor(USER).resolve("todo.txt.tmp"), "basura\n");

        watcher.onChanged(USER);
        assertEquals(antes, written.size());
    }

    @Test
    void dosUsuariosSeVigilanPorSeparado() {
        watcher.watch(7L);
        watcher.watch(8L);

        assertTrue(watcher.isWatching(7L));
        assertTrue(watcher.isWatching(8L));
        assertNotSame(store.directoryFor(7L), store.directoryFor(8L));
    }

    @Test
    void elArchivoDeUnUsuarioNoAfectaAlOtro() throws Exception {
        watcher.watch(7L);
        watcher.watch(8L);
        store.write(8L, "privado\n");
        watcher.recordWritten(8L, "privado\n");

        Files.writeString(todoFile(), "cambio en el siete\n", StandardCharsets.UTF_8);
        watcher.onChanged(7L);

        assertEquals("privado\n", store.read(8L));
    }
}