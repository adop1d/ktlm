package ktlm.service;

import ktlm.todotxt.TodoTxtCodec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * `note:` es una ruta, no un texto.
 *
 * <p>Es lo que hace tuxedo: `note:{path}`, y `O` abre ese archivo en el editor. No es una
 * decisión de gusto —el token se separa por espacios, así que un texto con varias palabras
 * se trunca en la primera— y encaja con que KTM ya tenga un directorio por usuario.
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
        // La ruta no puede tragarse el uid que va detrás.
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