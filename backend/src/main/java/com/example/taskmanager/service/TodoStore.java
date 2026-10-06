package com.example.taskmanager.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;

/**
 * El directorio de archivos todo.txt, ahora del servidor.
 *
 * <p>Cada usuario tiene el suyo bajo {@code data/todo/<userId>/} con los tres archivos que
 * usa tuxedo: {@code todo.txt}, {@code done.txt} e {@code inbox.txt}.
 *
 * <p>Cambiar esto es lo que desbloquea al resto: mientras el archivo fuera del navegador,
 * un móvil no podía verlo y un servidor MCP no tenía por dónde entrar. Ahora hay un solo
 * archivo y todos leen del mismo sitio.
 *
 * <p>La escritura es atómica —temporal y renombrado— porque tuxedo hace lo mismo y porque
 * un corte a mitad dejaría un todo.txt truncado.
 */
@Component
public class TodoStore {

    private static final String TODO = "todo.txt";
    private static final String DONE = "done.txt";
    private static final String INBOX = "inbox.txt";

    private final Path root;

    public TodoStore(@Value("${todo.data-dir:./data/todo}") String dataDir) {
        this.root = Path.of(dataDir).toAbsolutePath().normalize();
    }

    public Path directoryFor(Long userId) {
        return root.resolve(String.valueOf(userId));
    }

    /** El todo.txt del usuario. Si no existe todavía, devuelve vacío y lo crea al escribir. */
    public String read(Long userId) {
        return readFile(directoryFor(userId).resolve(TODO));
    }

    public String readDone(Long userId) {
        return readFile(directoryFor(userId).resolve(DONE));
    }

    /** Las líneas del done.txt, sin comentarios ni vacías. Es lo que consume la vista de archivo. */
    public List<String> readDoneLines(Long userId) {
        return readDone(userId).lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                .toList();
    }

    public List<String> readInboxLines(Long userId) {
        return readFile(directoryFor(userId).resolve(INBOX)).lines()
                .map(String::trim)
                .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                .toList();
    }

    public void write(Long userId, String content) {
        writeFile(directoryFor(userId).resolve(TODO), content);
    }

    public void appendDone(Long userId, String content) {
        Path done = directoryFor(userId).resolve(DONE);
        String previous = readFile(done);
        writeFile(done, previous.isEmpty() ? content : previous + content);
    }

    /**
     * Añade una línea al inbox y la devuelve. Vaciarlo ANTES de importar es lo que evita
     * reprocesar lo mismo en cada pasada; si la importación fallara, esas líneas se
     * pierden, que es el mismo compromiso que hace el drenaje de tuxedo.
     */
    public String consumeInbox(Long userId) {
        Path inbox = directoryFor(userId).resolve(INBOX);
        String pending = readFile(inbox);
        if (pending.isBlank()) {
            return "";
        }
        writeFile(inbox, EMPTY);
        return pending;
    }

    /** Añade una línea al inbox conservando lo que ya hubiera. */
    public void appendInbox(Long userId, String line) {
        Path inbox = directoryFor(userId).resolve(INBOX);
        writeFile(inbox, readFile(inbox) + line.strip() + "\n");
    }

    public void writeInbox(Long userId, String content) {
        writeFile(directoryFor(userId).resolve(INBOX), content);
    }

    /**
     * Compara el archivo con lo último importado. Es lo que permite decidir si hay que
     * reimportar, sin tener que hacerlo siempre.
     */
    public String hash(Long userId) {
        return hashOf(read(userId));
    }

    public static String hashOf(String content) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(content.getBytes(StandardCharsets.UTF_8));
            var out = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                out.append(Character.forDigit((b >> 4) & 0xF, 16));
                out.append(Character.forDigit(b & 0xF, 16));
            }
            return out.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }

    private static final String EMPTY = "";

    private String readFile(Path path) {
        try {
            return Files.exists(path) ? Files.readString(path, StandardCharsets.UTF_8) : EMPTY;
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo leer " + path, e);
        }
    }

    private void writeFile(Path path, String content) {
        try {
            Files.createDirectories(path.getParent());
            Path temp = path.resolveSibling(path.getFileName() + ".tmp");
            Files.writeString(temp, content, StandardCharsets.UTF_8);
            try {
                Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException e) {
                // Algunos sistemas de archivos no lo soportan; el renombrado a secas sigue
                // siendo mucho mejor que escribir encima.
                Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo escribir " + path, e);
        }
    }
}