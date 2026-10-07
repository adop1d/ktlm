package ktlm.service;

import ktlm.model.Task;
import ktlm.repository.TaskRepository;
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
 * Las notas: el archivo que va detrás de una tarea.
 *
 * <p>`note:` en el todo.txt no guarda el texto, guarda una ruta, que es lo que hace tuxedo:
 * `O` abre ese archivo en el editor. Aquí es un archivo del directorio del usuario, y la
 * ruta es relativa a él: absoluta, en el archivo se vería el HOME del contenedor y dejaría de
 * ser portable.
 *
 * <p>Por eso la ruta se valida en dos pasos: sin `..`, y luego comprobando que el archivo
 * resuelto sigue dentro del directorio del usuario. El primero evita rutas desperdiciadas,
 * el segundo es el que de verdad importa, porque un `..` filtrado a medias o un enlace
 * simbólico alcanzan el archivo de otro usuario. La comprobación es la segunda, siempre.
 */
@Service
public class NoteService {

    /** Tope de una nota. Es texto para leer en un editor, no un disco que rellenar. */
    private static final int MAX_NOTE = 1_000_000;

    private final TaskRepository tasks;
    private final TodoStore store;
    private final TodoTxtService todoTxt;

    public NoteService(TaskRepository tasks, TodoStore store, TodoTxtService todoTxt) {
        this.tasks = tasks;
        this.store = store;
        this.todoTxt = todoTxt;
    }

    /** Texto de la nota, o cadena vacía si la tarea no tiene. Nunca lanza por no existir. */
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
     * Guarda la nota y apunta la tarea a ella.
     *
     * <p>Guardar vacío borra el archivo y quita el token `note:` de la línea: una nota que
     * se vacía no debería dejar un archivo vacío y una ruta colgando.
     */
    @Transactional
    public void write(Long userId, Long taskId, String contenido) {
        if (contenido != null && contenido.length() > MAX_NOTE) {
            // Sin esto, un solo POST puede escribir un gigabyte en el volumen de todos los
            // usuarios. Tomcat no acota un cuerpo text/plain que llega entero a la memoria.
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
                // Relativa al directorio del usuario: en el archivo, portable.
                task.setNote("notas/" + destino.getFileName());
            }
            tasks.save(task);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo guardar la nota: " + e.getMessage(), e);
        }

        // El token `note:` vive en la línea del archivo, así que guardar la nota sin
        // reescribir el archivo dejaría la tarea apuntando a algo que no sale. Y después
        // de confirmar, no antes: escribirlo dentro dejaría un todo.txt con una nota que
        // luego desaparece si la transacción falla.
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
     * Resuelve la ruta y comprueba que no se sale del directorio del usuario.
     *
     * <p>Es la comprobación que importa. Un `..` o un enlace simbólico pueden salir del
     * directorio aunque la ruta «parezca» interna, así que se normaliza y se compara con
     * la raíz real.
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
        // normalize() no sigue enlaces simbólicos. Si la nota existe, se compara la ruta
        // real: un enlace dentro del directorio puede apuntar al archivo de otro usuario.
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

    /** El nombre por defecto que propone `o` cuando la tarea no tiene nota. */
    public static String nombreSugerido(Task task) {
        String base = task.getTitle() == null ? "nota" : task.getTitle()
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");
        return (base.isEmpty() ? "nota" : base) + ".md";
    }
}