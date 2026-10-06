package com.example.taskmanager.service;

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
 * Empuja los cambios de tareas a las sesiones abiertas, en vez de que cada cliente pregunte
 * cada diez segundos.
 *
 * SSE y no WebSocket porque el flujo va en una sola dirección y no necesita reconexión
 * negociada; y fetch con ReadableStream en vez de EventSource porque EventSource no admite
 * cabeceras, y aquí cada petición va autenticada.
 *
 * El registro es en memoria y por usuario. Con varias réplicas detrás haría falta un bus
 * compartido (LISTEN/NOTIFY de Postgres o Redis); hoy el compose es una sola instancia y eso
 * no lo justifica todavía.
 */
@Component
public class TaskEventStream {

    /** Muy por encima de los 25 s que impone nginx, para que no lo corte por debajo. */
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

        // Un comentario abre la conexión al instante: sin esto, un proxy puede esperar
        // hasta el primer evento real y el cliente cree que se quedó colgado.
        try {
            emitter.send(SseEmitter.event().name("connected").data("ok"));
        } catch (IOException e) {
            remove.run();
            emitter.completeWithError(e);
        }
        return emitter;
    }

    public void publish(Long userId) {
        Set<SseEmitter> emitters = byUser.get(userId);
        if (emitters == null) return;
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event().name("tasks").data("changed"));
            } catch (Exception e) {
                // La conexión está muerta: el emitter se encarga de limpiarse.
                emitter.complete();
            }
        }
    }

    /** Desconecta lo que el cliente dejó abierto sin cerrar del todo. */
    @Scheduled(fixedRate = 60_000)
    public void sweepStaleConnections() {
        byUser.values().forEach(emitters -> emitters.removeIf(emitter -> {
            try {
                emitter.send(SseEmitter.event().comment("keepalive"));
                return false;
            } catch (Exception e) {
                return true;
            }
        }));
    }

    /** Evento interno: las tareas de un usuario cambiaron. */
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
