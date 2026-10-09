package ktm.service;

import ktm.model.Task;
import ktm.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

/**
 * Notes: the file that sits behind a task.
 *
 * <p>`note:` in todo.txt does not store the text, it stores a path, which is what tuxedo
 * does: `O` opens that file in the editor. Here it is a file inside the user's directory,
 * and the path is relative to it: absolute, the file would show the container's HOME and
 * stop being portable.
 *
 * <p>So the path is validated in two steps: without `..`, then by checking that the
 * resolved file is still inside the user's directory. The first avoids wasted paths, the
 * second is the one that really matters, because a half-filtered `..` or a symbolic link
 * reaches another user's file. The check is the second one, always.
 */
@Service
public class NoteService {

    /** Cap on a note. It is text to read in an editor, not a disk to fill up. */
    private static final int MAX_NOTE = 1_000_000;

    private final TaskRepository tasks;
    private final TodoStore store;
    private final TodoTxtService todoTxt;

    public NoteService(TaskRepository tasks, TodoStore store, TodoTxtService todoTxt) {
        this.tasks = tasks;
        this.store = store;
        this.todoTxt = todoTxt;
    }

    /** The note's text, or an empty string if the task has none. Never throws for not existing. */
    @Transactional(readOnly = true)
    public String read(Long userId, Long taskId) {
        Path ruta = rutaDe(userId, taskId);
        if (ruta == null) {
            return "";
        }
        try {
            return Files.exists(ruta) ? Files.readString(ruta, StandardCharsets.UTF_8) : "";
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer la nota: " + e.getMessage(), e);
        }
    }

    /**
     * Saves the note and points the task at it.
     *
     * <p>Saving empty deletes the file and drops the `note:` token from the line: a note
     * that gets emptied should not leave an empty file and a dangling path behind.
     */
    @Transactional
    public void write(Long userId, Long taskId, String contenido) {
        if (contenido != null && contenido.length() > MAX_NOTE) {
            // Without this, a single POST can write a gigabyte into every user's
            // volume. Tomcat does not bound a text/plain body that arrives whole in memory.
            throw new IllegalArgumentException("La nota es demasiado grande");
        }
        Task task = tasks.findById(taskId)
                .filter(t -> userId.equals(t.getUserId()))
                .orElseThrow(() -> new IllegalArgumentException("Task not found with id: " + taskId));

        Path destino = store.directoryFor(userId).resolve("notas").resolve("nota-" + taskId + ".md");
        try {
            Files.createDirectories(destino.getParent());
            if (contenido == null || contenido.isBlank()) {
                Files.deleteIfExists(destino);
                task.setNote(null);
            } else {
                Files.writeString(destino, contenido, StandardCharsets.UTF_8);
                // Relative to the user's directory: portable in the file.
                task.setNote("notas/" + destino.getFileName());
            }
            tasks.save(task);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo guardar la nota: " + e.getMessage(), e);
        }

        // The `note:` token lives in the file's line, so saving the note without
        // rewriting the file would leave the task pointing at something that is not there.
        // And after the commit, not before: writing it inside would leave a todo.txt with a
        // note that later disappears if the transaction fails.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                todoTxt.persistToFile(userId);
            }
        });
    }

    private Path rutaDe(Long userId, Long taskId) {
        Task task = tasks.findById(taskId)
                .filter(t -> userId.equals(t.getUserId()))
                .orElseThrow(() -> new IllegalArgumentException("Task not found with id: " + taskId));
        if (task.getNote() == null || task.getNote().isBlank()) {
            return null;
        }
        return resolverDentro(userId, task.getNote());
    }

    /**
     * Resolves the path and checks that it does not escape the user's directory.
     *
     * <p>This is the check that matters. A `..` or a symbolic link can escape the
     * directory even when the path "looks" internal, so it is normalized and compared with
     * the real root.
     */
    private Path resolverDentro(Long userId, String relativa) {
        if (relativa.contains("..")) {
            throw new IllegalArgumentException("Ruta de nota inválida");
        }
        Path raiz = store.directoryFor(userId).toAbsolutePath().normalize();
        Path destino;
        try {
            destino = raiz.resolve(relativa).toAbsolutePath().normalize();
        } catch (java.nio.file.InvalidPathException e) {
            throw new IllegalArgumentException("Ruta de nota inválida", e);
        }
        if (!destino.startsWith(raiz)) {
            throw new IllegalArgumentException("La nota se sale del directorio del usuario");
        }
        // normalize() does not follow symbolic links. If the note exists, the real path is
        // compared: a link inside the directory can point at another user's file.
        if (Files.exists(destino)) {
            try {
                if (!destino.toRealPath().startsWith(raiz.toRealPath())) {
                    throw new IllegalArgumentException("La nota se sale del directorio del usuario");
                }
            } catch (IOException e) {
                throw new IllegalArgumentException("No se pudo resolver la ruta de la nota", e);
            }
        }
        return destino;
    }

    /** The default name `o` suggests when the task has no note. */
    public static String nombreSugerido(Task task) {
        String base = task.getTitle() == null ? "nota" : task.getTitle()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return (base.isEmpty() ? "nota" : base) + ".md";
    }
}