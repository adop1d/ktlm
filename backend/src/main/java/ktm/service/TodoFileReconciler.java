package ktm.service;

import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Reimports the files that changed from outside.
 *
 * <p>It exists so the watcher does not depend on {@link TodoTxtService}: both are needed
 * and Spring cannot wire a cycle. The watcher publishes the event, this one listens and
 * does the work.
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
        // The file is in charge now: it is the source. importFile writes back the
        // reconciled version, tells the watcher the change is already ours and publishes
        // the TasksChanged that refreshes the open sessions.
        todoTxt.importFile(userId, content);
    }
}
