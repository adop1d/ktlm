package ktm.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.ClosedWatchServiceException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardWatchEventKinds;
import java.nio.file.WatchEvent;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * Watches the server's todo.txt files and reimports the ones that change from outside.
 *
 * <p>This is what the browser used to do by polling its local copy. With the file on the
 * server, the server is the one watching: if someone opens the todo.txt with `vim`, this
 * finds out without anyone asking. It uses {@link WatchService} from the filesystem and not
 * a timer: no polling, events.
 *
 * <p>The hash of the last thing we wrote decides whether the change is ours or from
 * outside. Without that comparison, an API mutation could be read as an external edit and
 * import a stale file over what we just saved.
 */
@Component
public class TodoFileWatcher {

    /** Margin before re-reading: an editor writes in bursts and the temp file does not count yet. */
    private static final long SETTLE_MS = 150;

    private final TodoStore store;
    private final ApplicationEventPublisher events;

    /** Hash of the last thing we wrote ourselves, per user. */
    private final Map<Long, String> lastWritten = new ConcurrentHashMap<>();
    private final Map<Long, Path> watched = new ConcurrentHashMap<>();
    private final Map<Path, Long> owner = new ConcurrentHashMap<>();

    private WatchService watchService;
    private Thread thread;
    private volatile boolean running = true;

    public TodoFileWatcher(TodoStore store, ApplicationEventPublisher events) {
        this.store = store;
        this.events = events;
    }

    /**
     * The file changed from outside. It publishes it for someone else to reimport: the
     * watcher and the todo.txt service need each other and Spring cannot wire a cycle.
     */
    public record FileChanged(Long userId) {}

    /** The service calls it after each write, so we do not reimport our own. */
    public void recordWritten(Long userId, String content) {
        lastWritten.put(userId, TodoStore.hashOf(content));
    }

    /** Starts watching the user's directory. Idempotent. */
    public synchronized void watch(Long userId) {
        if (watched.containsKey(userId)) {
            return;
        }
        Path dir = store.directoryFor(userId);
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            return;
        }
        // If we never wrote, we take what is there as good: otherwise the first boot would
        // trigger an import of a file the user already had.
        lastWritten.putIfAbsent(userId, store.hash(userId));

        try {
            dir.register(watchService, StandardWatchEventKinds.ENTRY_MODIFY, StandardWatchEventKinds.ENTRY_CREATE);
            watched.put(userId, dir);
            owner.put(dir, userId);
        } catch (IOException e) {
            // A directory that cannot be watched is no reason to take the app down: it will
            // be reconciled anyway on the next write.
            lastWritten.remove(userId);
        }
    }

    @PostConstruct
    public void start() throws IOException {
        watchService = FileSystems.getDefault().newWatchService();
        thread = new Thread(this::loop, "todo-file-watcher");
        thread.setDaemon(true);
        thread.start();
    }

    @PreDestroy
    public void stop() {
        running = false;
        if (watchService != null) {
            try {
                watchService.close();
            } catch (IOException ignored) {
                // it does not matter on shutdown
            }
        }
    }

    private void loop() {
        while (running) {
            try {
                WatchKey key = watchService.poll(500, TimeUnit.MILLISECONDS);
                if (key == null) {
                    continue;
                }
                for (WatchEvent<?> event : key.pollEvents()) {
                    Object context = event.context();
                    if (!(context instanceof Path changed)) {
                        continue;
                    }
                    if (changed.getFileName().toString().endsWith(".tmp")) {
                        continue;  // it is our own atomic write
                    }
                    onChanged(owner.get(changed.getParent()));
                }
                key.reset();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (ClosedWatchServiceException e) {
                return;
            } catch (Exception e) {
                // A one-off failure cannot take down the whole watcher.
            }
        }
    }

    /** Reimports if the change is not ours. The file is in charge now: it is the source. */
    void onChanged(Long userId) {
        if (userId == null) {
            return;
        }
        try {
            Thread.sleep(SETTLE_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return;
        }

        String content = store.read(userId);
        String hash = TodoStore.hashOf(content);
        if (hash.equals(lastWritten.get(userId))) {
            return;  // lo escribimos nosotros
        }

        events.publishEvent(new FileChanged(userId));

    }

    /**
     * Safety net for the {@link WatchService}.
     *
     * <p>Filesystem events are the fast path: they arrive instantly. But they are not
     * reliable everywhere —on overlayfs, which is what Docker uses, there are cases where it
     * delivers nothing—. The sweep compares the hash with the last thing we wrote, so it
     * costs nothing when nothing has happened and covers the gap when the filesystem does
     * not notify.
     */
    @Scheduled(fixedDelay = 30_000, initialDelay = 30_000)
    public void sweep() {
        for (Long userId : java.util.List.copyOf(watched.keySet())) {
            String content = store.read(userId);
            if (!TodoStore.hashOf(content).equals(lastWritten.get(userId))) {
                events.publishEvent(new FileChanged(userId));
            }
        }
    }

    /** Tests only: who owns a directory. */
    Long ownerOf(Path dir) {
        return owner.get(dir);
    }

    boolean isWatching(Long userId) {
        return watched.containsKey(userId);
    }
}