package com.example.taskmanager.todotxt;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * El contrato se fija contra el comportamiento real de tuxedo 2026.8.1, no contra una idea de
 * lo que "debería" ser todo.txt: los tags son tokens sueltos, los comentarios se saltan y el
 * orden de serialización es el suyo.
 */
class TodoTxtCodecTest {

    private final TodoTxtCodec codec = new TodoTxtCodec();

    private static String fixture() throws IOException {
        try (InputStream in = TodoTxtCodecTest.class.getResourceAsStream("/todo/tuxedo-sample.txt")) {
            assertNotNull(in, "falta el recurso todo/tuxedo-sample.txt");
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @Test
    void parsesPriorityCreatedTagsAndDue() {
        ParsedTask t = codec.parse("(A) 2026-04-28 Call dentist @phone +health due:2026-05-08").get(0);

        assertEquals('A', t.priority());
        assertEquals(LocalDate.of(2026, 4, 28), t.created());
        assertEquals("Call dentist", t.body());
        assertEquals(List.of("health"), t.projects());
        assertEquals(List.of("phone"), t.contexts());
        assertEquals(LocalDate.of(2026, 5, 8), t.due());
        assertFalse(t.done());
    }

    @Test
    void parsesDoneWithCompletedAndCreatedDates() {
        ParsedTask t = codec.parse("x 2026-05-05 2026-05-01 Submit expense report +work").get(0);

        assertTrue(t.done());
        assertEquals(LocalDate.of(2026, 5, 5), t.completed());
        assertEquals(LocalDate.of(2026, 5, 1), t.created());
        assertEquals("Submit expense report", t.body());
        assertEquals(List.of("work"), t.projects());
    }

    @Test
    void parsesRecurrenceAlongsideCreatedDate() {
        ParsedTask t = codec.parse("2026-05-09 Pay rent due:2026-05-15 rec:+1m").get(0);

        assertEquals(LocalDate.of(2026, 5, 9), t.created());
        assertEquals("Pay rent", t.body());
        assertEquals("+1m", t.recurrence());
        assertNull(t.priority());
    }

    @Test
    void createdDateIsOnlyTakenFromStrictIsoToken() {
        // "2026" es un año suelto: no es una fecha y debe quedarse en el cuerpo.
        ParsedTask t = codec.parse("2026 no es fecha").get(0);

        assertNull(t.created());
        assertEquals("2026 no es fecha", t.body());
    }

    @Test
    void nonIsoDueIsDroppedAndNotKeptAsExtra() {
        ParsedTask t = codec.parse("Pay rent due:manana").get(0);

        assertNull(t.due());
        assertTrue(t.extras().isEmpty(), "un due: no ISO no debe acabar en extras");
        assertEquals("Pay rent", t.body());
    }

    @Test
    void tagsMustBeWholeTokens() {
        ParsedTask t = codec.parse("foo+bar baz@qux +real @real2").get(0);

        assertEquals("foo+bar baz@qux", t.body());
        assertEquals(List.of("real"), t.projects());
        assertEquals(List.of("real2"), t.contexts());
    }

    @Test
    void extrasPreserveUnknownTokensVerbatim() {
        ParsedTask t = codec.parse("Draft note:projects/x.md uid:7").get(0);

        assertEquals(Map.of("note", "projects/x.md"), t.extras());
        assertEquals("7", t.todoUid());
        assertEquals("Draft", t.body());
    }

    @Test
    void skipsBlankAndCommentLinesButKeepsRawIntact() throws IOException {
        List<ParsedTask> tasks = codec.parse(fixture());

        assertEquals(5, tasks.size(), "solo las 5 tareas, ni el comentario ni la línea en blanco");
        for (ParsedTask t : tasks) {
            assertFalse(t.raw().startsWith("#"), "una línea de comentario no debe llegar aquí");
        }
    }

    @Test
    void rawKeepsOriginalLineVerbatim() throws IOException {
        ParsedTask first = codec.parse(fixture()).get(0);

        assertEquals("(A) 2026-04-28 Call dentist @phone +health due:2026-05-08", first.raw());
    }

    @Test
    void serializeMinimalTaskHasNoLeadingOrDoubleSpaces() {
        String out = codec.serialize(List.of(
                new ParsedTask(null, null, "Buy milk", null, null, null, null, null, false, null, null, null, "")));

        assertEquals("Buy milk\n", out);
        assertFalse(out.startsWith(" "));
        assertFalse(out.contains("  "));
    }

    @Test
    void serializeOmitsNullAndEmptyFields() {
        String out = codec.serialize(List.of(new ParsedTask(
                null, null, "Solo cuerpo", List.of(), List.of(), null, "", null, false, null, "", Map.of(), "")));

        assertEquals("Solo cuerpo\n", out);
        assertFalse(out.contains("due:"));
        assertFalse(out.contains("rec:"));
        assertFalse(out.contains("uid:"));
    }

    @Test
    void serializeEmptyListIsEmptyString() {
        assertEquals("", codec.serialize(List.of()));
    }

    @Test
    void roundTripIsStableForKnownCases() {
        String source = "(A) 2026-04-28 Call dentist @phone +health due:2026-05-08\n"
                + "x 2026-05-05 2026-05-01 Submit expense report +work uid:3\n";

        String once = codec.serialize(codec.parse(source));
        String twice = codec.serialize(codec.parse(once));

        assertEquals(once, twice);
    }

    @Test
    void roundTripIsStableForAwkwardInput() {
        String source = "Compra urgentisima http://ejemplo.com/ruta foo:bar\n"
                + "2026-13-45 fecha imposible due:tarde\n";

        String once = codec.serialize(codec.parse(source));
        String twice = codec.serialize(codec.parse(once));
        ParsedTask t = codec.parse(once).get(0);

        assertEquals(once, twice, "el round-trip debe ser estable tambien con ruido");
        // Una URL es "clave:valor" tanto como lo es due:, asi que acaba en extras. No es un
        // error: el formato no distingue una cosa de la otra.
        assertTrue(t.extras().containsKey("http"));
        assertNull(t.due(), "una due: no ISO no es una fecha");
    }

    @Test
    void fixtureSerializesBackToCanonicalOrder() throws IOException {
        String out = codec.serialize(codec.parse(fixture()));

        assertEquals("(A) 2026-04-28 Call dentist +health @phone due:2026-05-08", lines(out)[0]);
        assertEquals("2026-05-09 Pay rent due:2026-05-15 rec:+1m", lines(out)[1]);
        assertEquals("x 2026-05-05 2026-05-01 Submit expense report +work", lines(out)[2]);
        assertEquals("Pay rent +home @bank due:2026-06-01 rec:+1m t:-3d uid:42", lines(out)[3]);
        assertEquals("Buy milk", lines(out)[4]);
    }

    @Test
    void matchesTuxedoSampleDocument() throws IOException {
        List<ParsedTask> tasks = codec.parse(fixture());

        ParsedTask uid42 = tasks.get(3);
        assertEquals("42", uid42.todoUid());
        assertEquals("+1m", uid42.recurrence());
        assertEquals("-3d", uid42.threshold());
        assertEquals(LocalDate.of(2026, 6, 1), uid42.due());
        assertEquals(List.of("home"), uid42.projects());
        assertEquals(List.of("bank"), uid42.contexts());
    }

    private static String[] lines(String text) {
        return text.split("\n");
    }
}