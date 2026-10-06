package com.example.taskmanager.service;

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
 * Vigila los archivos todo.txt del servidor y reimporta los que cambian por fuera.
 *
 * <p>Es esto lo que antes hacía el navegador sondeando su copia local. Con el archivo en el
 * servidor, quien vigila es el servidor: si alguien abre el todo.txt con `vim`, aquí se
 * entera sin que nadie pregunte. Usa {@link WatchService} del sistema de archivos y no un
 * temporizador: no hay sondeo, hay eventos.
 *
 * <p>El hash de lo último que escribimos es lo que decide si el cambio es nuestro o de
 * fuera. Sin esa comparación, una mutación de la API podría interpretarse como edición
 * externa e importar un archivo viejo por encima de lo que acabamos de guardar.
 */
@Component
public class TodoFileWatcher {

    /** Margen antes de releer: un editor escribe en ráfagas y el temporal todavía no cuenta. */
    private static final long SETTLE_MS = 150;

    private final TodoStore store;
    private final ApplicationEventPublisher events;

    /** Hash de lo último que escribimos nosotros, por usuario. */
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
     * El archivo cambió por fuera. Lo publica para que otro lo reimporte: el vigilante y el
     * servicio de todo.txt se necesitan mutuamente y Spring no puede cablear un círculo.
     */
    public record FileChanged(Long userId) {}

    /** El servicio lo llama tras cada escritura, para no reimportar lo nuestro. */
    public void recordWritten(Long userId, String content) {
        lastWritten.put(userId, TodoStore.hashOf(content));
    }

    /** Empieza a vigilar el directorio del usuario. Idempotente. */
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
        // Si nunca escribimos, damos por bueno lo que hay: si no, el primer arranque
        // dispararía una importación de un archivo que el usuario ya tenía.
        lastWritten.putIfAbsent(userId, store.hash(userId));

        try {
            dir.register(watchService, StandardWatchEventKinds.ENTRY_MODIFY, StandardWatchEventKinds.ENTRY_CREATE);
            watched.put(userId, dir);
            owner.put(dir, userId);
        } catch (IOException e) {
            // Un directorio que no se puede vigilar no es motivo para tumbar la app: se
            // reconciliará de todos modos en la siguiente escritura.
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
                // al apagar da igual
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
                        continue;  // es nuestra propia escritura atómica
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
                // Un fallo puntual no puede tumbar el vigilante entero.
            }
        }
    }

    /** Reimporta si el cambio no es nuestro. Ahora manda el archivo: es la fuente. */
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
     * Red de seguridad del {@link WatchService}.
     *
     * <p>Los eventos del sistema de archivos son la vía rápida: llegan al instante. Pero no
     * son fiables en todas partes —sobre overlayfs, que es lo que usa Docker, hay casos en que
     * no entrega nada—. El barrido compara el hash con lo último que escribimos, así que no
     * cuesta nada cuando no ha pasado nada y cubre el hueco cuando el sistema de archivos
     * no avisa.
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

    /** Sólo para pruebas: quién es dueño de un directorio. */
    Long ownerOf(Path dir) {
        return owner.get(dir);
    }

    boolean isWatching(Long userId) {
        return watched.containsKey(userId);
    }
}