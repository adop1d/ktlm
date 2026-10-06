package com.example.taskmanager.service;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Reimporta los archivos que cambiaron por fuera.
 *
 * <p>Existe para que el vigilante no dependa de {@link TodoTxtService}: los dos se necesitan
 * y Spring no puede cablear un círculo. El vigilante publica el evento, este lo escucha y
 * hace el trabajo.
 */
@Component
public class TodoFileReconciler {

    private final TodoTxtService todoTxt;
    private final TodoFileWatcher watcher;

    public TodoFileReconciler(TodoTxtService todoTxt, TodoFileWatcher watcher) {
        this.todoTxt = todoTxt;
        this.watcher = watcher;
    }

    @EventListener
    public void onFileChanged(TodoFileWatcher.FileChanged event) {
        Long userId = event.userId();
        String content = todoTxt.currentFile(userId);
        if (content.isBlank()) {
            return;
        }
        // Ahora manda el archivo: es la fuente. importFile escribe de vuelta la versión
        // reconciliada, avisa al vigilante de que el cambio ya es nuestro y publica el
        // TasksChanged que refresca las sesiones abiertas.
        todoTxt.importFile(userId, content);
    }
}
