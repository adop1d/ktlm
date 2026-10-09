package ktm.service;

import ktm.model.Task;
import ktm.todotxt.TodoTxtCodec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What the file needs and the database still does not have.
 *
 * <p>The order and the `uid:` are assigned by the importer when it reads the file. A
 * change arriving the other way —an MCP server batch, a note— does not go through
 * there, so they have to be prepared before writing: the client uses the `uid` to call
 * the API, and a line without `uid` points at task 0. The change is lost without an
 * error, which is the worst thing that can happen.
 */
class FileWritingReadinessTest {

    private final TodoTxtCodec codec = new TodoTxtCodec();

    @Test
    @DisplayName("sin uid la línea no se puede tocar desde la API")
    void elUidEsLoQuePermiteActuar() {
        assertThat(codec.parse("(A) 2026-01-01 Con uid uid:7\n").get(0).todoUid()).isEqualTo("7");
        // The case that used to break: the line exists, but there is nothing to call
        // /api/tasks/{id} with, so completing or deleting from the web does nothing.
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