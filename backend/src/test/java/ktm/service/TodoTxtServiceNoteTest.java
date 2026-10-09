package ktm.service;

import ktm.todotxt.TodoTxtCodec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * `note:` is a path, not a text.
 *
 * <p>That is what tuxedo does: `note:{path}`, and `O` opens that file in the editor. It is
 * not a matter of taste —the token is split on spaces, so a multi-word text gets cut at
 * the first one— and it fits KTM already having one directory per user.
 */
class TodoTxtServiceNoteTest {

    private final TodoTxtCodec codec = new TodoTxtCodec();

    @Test
    @DisplayName("la ruta de la nota va y vuelve sin duplicarse")
    void idaYVuelta() {
        String archivo = "(A) 2026-01-01 Revisar el contrato +pagos note:notas/contrato.md uid:7\n";

        var lineas = codec.parse(archivo);
        assertThat(lineas).hasSize(1);
        assertThat(lineas.get(0).extras()).containsEntry("note", "notas/contrato.md");

        String reescrito = codec.serialize(lineas);
        assertThat(reescrito).containsOnlyOnce("note:");
        assertThat(reescrito).contains("note:notas/contrato.md");
        // The path must not swallow the uid that comes after it.
        assertThat(reescrito).contains("uid:7");
    }

    @Test
    @DisplayName("sin nota no aparece el token")
    void sinNota() {
        String reescrito = codec.serialize(codec.parse("(A) 2026-01-01 Sencilla uid:1\n"));
        assertThat(reescrito).doesNotContain("note:");
    }

    @Test
    @DisplayName("la nota se coloca antes del uid, no después")
    void ordenDeLosTokens() {
        var lineas = codec.parse(List.of("(A) 2026-01-01 Con nota note:notas/x.md uid:3\n").toString());
        String reescrito = codec.serialize(lineas);
        assertThat(reescrito.indexOf("note:")).isLessThan(reescrito.indexOf("uid:"));
    }
}