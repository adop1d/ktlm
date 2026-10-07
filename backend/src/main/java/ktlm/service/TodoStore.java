package ktlm.service;

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
 * The directory of todo.txt files, now on the server.
 *
 * <p>Every user has one under {@code data/todo/<userId>/} with the three files tuxedo uses:
 * {@code todo.txt}, {@code done.txt} and {@code inbox.txt}.
 *
 * <p>Changing this is what unlocks the rest: while the file was in the browser, a phone
 * could not see it and an MCP server had no way in. Now there is one file and everyone
 * reads from the same place.
 *
 * <p>The write is atomic —temp file and rename— because tuxedo does the same and because
 * a cut halfway would leave a truncated todo.txt.
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

    /** The user's todo.txt. If it does not exist yet, returns empty and creates it on write. */
    public String read(Long userId) {
        return readFile(directoryFor(userId).resolve(TODO));
    }

    public String readDone(Long userId) {
        return readFile(directoryFor(userId).resolve(DONE));
    }

    /** The lines of done.txt, without comments or blanks. This is what the file view consumes. */
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
     * Adds a line to the inbox and returns it. Emptying it BEFORE importing is what avoids
     * reprocessing the same thing on every pass; if the import failed, those lines are
     * lost, which is the same trade-off tuxedo's drain makes.
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

    /** Adds a line to the inbox keeping whatever was already there. */
    public void appendInbox(Long userId, String line) {
        Path inbox = directoryFor(userId).resolve(INBOX);
        writeFile(inbox, readFile(inbox) + line.strip() + "\n");
    }

    public void writeInbox(Long userId, String content) {
        writeFile(directoryFor(userId).resolve(INBOX), content);
    }

    /**
     * Compares the file with what was last imported. It is what lets us decide whether to
     * reimport, without having to do it every time.
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
                // Some filesystems do not support it; a plain rename is still
                // much better than writing over it.
                Files.move(temp, path, StandardCopyOption.REPLACE_EXISTING);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("No se pudo escribir " + path, e);
        }
    }
}