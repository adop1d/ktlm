package ktlm.service;

import ktlm.dto.TaskRequest;
import ktlm.model.Task;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * El lote: qué devuelve, qué rechaza y dónde para.
 *
 * <p>Sin Mockito, que aquí no instrumenta las clases, y sin base de datos, que en esta
 * máquina no es la del compose. Ninguna de las dos cosas hace falta para lo que se
 * comprueba: la forma de las llamadas y el punto de parada de un lote fallido.
 *
 * <p>Lo que sí necesita una base de datos es que la transacción revierta de verdad, y eso
 * se verifica en vivo contra el servidor, que es donde además importa.
 */
class TaskBatchServiceTest {

    /** Doble a mano: anota lo que le llega y devuelve una tarea con uid fijo. */
    static class FakeTasks extends TaskService {
        final List<TaskRequest> received = new ArrayList<>();
        final List<String> calls = new ArrayList<>();
        RuntimeException failOn;
        int failAtCall = -1;

        FakeTasks() {
            super(null, null);
        }

        /** Falla solo en la llamada indicada: así se ve dónde para el lote. */
        private void maybeFail() {
            if (failOn != null && calls.size() == failAtCall) {
                throw failOn;
            }
        }

        private Task make() {
            Task task = new Task();
            task.setId(42L);
            task.setTodoUid("42");
            return task;
        }

        @Override
        public Task createTask(TaskRequest request, Long userId) {
            received.add(request);
            calls.add("create");
            maybeFail();
            return make();
        }

        @Override
        public Task updateTask(Long id, Long userId, TaskRequest request) {
            received.add(request);
            calls.add("update:" + id);
            maybeFail();
            return make();
        }

        @Override
        public Task toggleTaskCompletion(Long id, Long userId) {
            calls.add("toggle:" + id);
            maybeFail();
            return make();
        }

        @Override
        public void deleteTask(Long id, Long userId) {
            calls.add("delete:" + id);
            maybeFail();
        }
    }

    /** Doble de todo.txt: solo cuenta cuántas veces se le pide escribir. */
    static class FakeTodoTxt extends TodoTxtService {
        int escrituras;

        FakeTodoTxt() {
            super(null, null, null, null, null);
        }

        @Override
        public String persistToFile(Long userId) {
            escrituras++;
            return "";
        }
    }

    private final FakeTasks tasks = new FakeTasks();
    private final FakeTodoTxt todoTxt = new FakeTodoTxt();
    private final TaskBatchService batch = new TaskBatchService(tasks, todoTxt);
    private final Long userId = 7L;

    private static Map<String, Object> op(String name, Object... kv) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("op", name);
        for (int i = 0; i < kv.length; i += 2) {
            map.put((String) kv[i], kv[i + 1]);
        }
        return map;
    }

    @Test
    @DisplayName("aplica cada operación y devuelve su uid")
    void aplicaCadaOperacion() {
        List<Map<String, Object>> results = batch.apply(userId, List.of(
                op("create", "title", "primera"),
                op("create", "title", "segunda")));

        assertThat(results).hasSize(2);
        assertThat(results).allSatisfy(r -> {
            assertThat(r).containsEntry("op", "create").containsEntry("ok", true).containsEntry("uid", 42L);
        });
        assertThat(tasks.calls).containsExactly("create", "create");
    }

    @Test
    @DisplayName("un update parcial no manda los campos que no trae")
    void updateParcialNoMandaDeMas() {
        batch.apply(userId, List.of(op("update", "uid", 9, "title", "nuevo")));

        TaskRequest enviado = tasks.received.get(0);
        assertThat(enviado.title()).isEqualTo("nuevo");
        // Si estos fueran null-insertados, un update parcial borraría los proyectos de la tarea.
        assertThat(enviado.projects()).isNull();
        assertThat(enviado.contexts()).isNull();
        assertThat(enviado.priority()).isNull();
        assertThat(enviado.completed()).isNull();
        assertThat(enviado.dueDate()).isNull();
    }

    @Test
    @DisplayName("lee listas y prioridad de la operación")
    void leeListasYPrioridad() {
        batch.apply(userId, List.of(op("create", "title", "con todo",
                "projects", List.of("casa", "trabajo"), "priority", "HIGH")));

        TaskRequest enviado = tasks.received.get(0);
        assertThat(enviado.projects()).containsExactly("casa", "trabajo");
        assertThat(enviado.priority()).isEqualTo(Task.Priority.HIGH);
    }

    @Test
    @DisplayName("un lote que falla dice en qué operación paró")
    void diceDondeParo() {
        tasks.failOn = new IllegalArgumentException("no existe");
        tasks.failAtCall = 2; // la segunda: la primera tiene que llegar a aplicarse

        assertThatThrownBy(() -> batch.apply(userId, List.of(
                op("create", "title", "esta sí"),
                op("toggle", "uid", 999))))
                .isInstanceOf(TaskBatchService.BatchFailed.class)
                .hasMessageContaining("operación 1")
                .hasMessageContaining("no existe")
                .satisfies(e -> assertThat(((TaskBatchService.BatchFailed) e).getFailedAt()).isEqualTo(1));

        assertThat(todoTxt.escrituras).isZero();
    }

    @Test
    @DisplayName("rechaza lote vacío, lote enorme y operación desconocida")
    void limites() {
        assertThatThrownBy(() -> batch.apply(userId, List.of()))
                .isInstanceOf(IllegalArgumentException.class);

        List<Map<String, Object>> enorme = new ArrayList<>();
        for (int i = 0; i < 201; i++) {
            enorme.add(op("create", "title", "t" + i));
        }
        assertThatThrownBy(() -> batch.apply(userId, enorme))
                .isInstanceOf(IllegalArgumentException.class);

        assertThatThrownBy(() -> batch.apply(userId, List.of(op("volar", "uid", 1))))
                .isInstanceOf(TaskBatchService.BatchFailed.class)
                .hasMessageContaining("operación desconocida");
    }

    @Test
    @DisplayName("toggle y delete llegan con su uid")
    void toggleYDelete() {
        batch.apply(userId, List.of(op("toggle", "uid", 3), op("delete", "uid", 4)));
        assertThat(tasks.calls).containsExactly("toggle:3", "delete:4");
    }

    @Test
    @DisplayName("el archivo se escribe una vez por lote, no una por operación")
    void escribeElArchivoUnaVez() {
        batch.apply(userId, List.of(op("create", "title", "a"), op("create", "title", "b")));
        assertThat(todoTxt.escrituras).isEqualTo(1);
    }
}