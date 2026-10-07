package ktlm.service;

import ktlm.model.Task;
import ktlm.todotxt.TodoTxtCodec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Lo que el archivo necesita y la base todavía no tiene.
 *
 * <p>El orden y el `uid:` los asigna el importador al leer el archivo. Un cambio que llega
 * por otro lado —el lote del servidor MCP, una nota— no pasa por ahí, así que hay que
 * prepararlos antes de escribir: el cliente usa el `uid` para llamar a la API, y una línea
 * sin `uid` apunta a la tarea 0. El cambio se pierde sin error, que es lo peor que puede
 * pasar.
 */
class FileWritingReadinessTest {

    private final TodoTxtCodec codec = new TodoTxtCodec();

    @Test
    @DisplayName("sin uid la línea no se puede tocar desde la API")
    void elUidEsLoQuePermiteActuar() {
        assertThat(codec.parse("(A) 2026-01-01 Con uid uid:7\n").get(0).todoUid()).isEqualTo("7");
        // El caso que rompía: la línea existe, pero no hay con quién llamar a
        // /api/tasks/{id}, así que completar o borrar desde la web no hacen nada.
        assertThat(codec.parse("(A) 2026-01-01 Sin uid\n").get(0).todoUid()).isNull();
    }

    @Test
    @DisplayName("el uid sobrevive al viaje de ida y vuelta")
    void elUidRoundTrip() {
        String reescrito = codec.serialize(codec.parse("(A) 2026-01-01 Tarea uid:42\n"));
        assertThat(reescrito).contains("uid:42");
        assertThat(codec.parse(reescrito).get(0).todoUid()).isEqualTo("42");
    }
}