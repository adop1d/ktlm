package ktm.service;

import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Pushes task changes to the open sessions, instead of every client polling every ten
 * seconds.
 *
 * SSE and not WebSocket because the stream goes one way and needs no negotiated
 * reconnection; and fetch with ReadableStream instead of EventSource because EventSource
 * does not support headers, and here every request is authenticated.
 *
 * The registry is in memory and per user. With several replicas behind it you would need a
 * shared bus (Postgres LISTEN/NOTIFY or Redis); today the compose is a single instance and
 * that does not justify it yet.
 */
@Component
public class TaskEventStream {

    /** Well above the 25 s nginx imposes, so it does not cut it shorter. */
    private static final long TIMEOUT_MS = 30 * 60 * 1000;

    private final Map<Long, Set<SseEmitter>> byUser = new ConcurrentHashMap<>();

    public SseEmitter subscribe(Long userId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        byUser.computeIfAbsent(userId, key -> ConcurrentHashMap.newKeySet()).add(emitter);

        Runnable remove = () -> {
            Set<SseEmitter> emitters = byUser.get(userId);
            if (emitters == null) return;
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                byUser.remove(userId);
            }
        };

        emitter.onCompletion(remove);
        emitter.onTimeout(() -> {
            remove.run();
            emitter.complete();
        });
        emitter.onError(error -> remove.run());

        // A comment opens the connection instantly: without it, a proxy may wait until the
        // first real event and the client thinks it hung.
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            remove.run();
            emitter.completeWithError(e);
        }
        return emitter;
    }

    /**
     * Writes to an emitter without two threads stepping on each other.
     *
     * <p>{@code SseEmitter.send} is not thread-safe: two writes at once interleave and the
     * stream comes out corrupt. And that really happened —{@code publish} is called by the
     * file watcher and by HTTP requests, and the sweep below calls it in turn every minute,
     * all over the same emitters— and the symptom was a client dropping with
     * ERR_EMPTY_RESPONSE without anyone having closed anything.
     */
    private static boolean enviar(SseEmitter emitter, SseEmitter.SseEventBuilder evento) {
        synchronized (emitter) {
            try {
                emitter.send(evento);
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    public void publish(Long userId) {
        Set<SseEmitter> emitters = byUser.get(userId);
        if (emitters == null) return;
        for (SseEmitter emitter : emitters) {
            if (!enviar(emitter, SseEmitter.event().name("tasks").data("changed"))) {
                // The connection is dead: the emitter takes care of cleaning itself up.
                emitter.complete();
            }
        }
    }

    /**
     * Disconnects what the client left open without closing it fully.
     *
     * <p>It also drops the map entry when it becomes empty. Removing it from the set is not
     * enough: the user's key stayed there forever, with an empty set, and one user per
     * account created occupied memory without ever opening the stream.
     */
    @Scheduled(fixedRate = 60_000)
    public void sweepStaleConnections() {
        byUser.forEach((userId, emitters) -> {
            emitters.removeIf(emitter -> !enviar(emitter, SseEmitter.event().comment("keepalive")));
            if (emitters.isEmpty()) {
                byUser.remove(userId);
            }
        });
    }

    /** Internal event: a user's tasks changed. */
    public record TasksChanged(Long userId) {}

    @Component
    public static class Listener {

        private final TaskEventStream stream;

        public Listener(TaskEventStream stream) {
            this.stream = stream;
        }

        @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
        public void onChange(TasksChanged event) {
            stream.publish(event.userId());
        }
    }
}
