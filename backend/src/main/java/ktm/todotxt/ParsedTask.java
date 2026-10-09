package ktm.todotxt;

import java.time.LocalDate;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A single todo.txt line, already decomposed.
 *
 * <p>Collections are never null and always immutable. {@code extras} keeps the
 * insertion (appearance) order of unknown {@code key:value} tokens and never
 * holds the known keys {@code due}, {@code rec}, {@code t} or {@code uid}.
 */
public record ParsedTask(
        Character priority,
        LocalDate created,
        String body,
        List<String> projects,
        List<String> contexts,
        LocalDate due,
        String recurrence,
        String threshold,
        boolean done,
        LocalDate completed,
        String todoUid,
        Map<String, String> extras,
        String raw) {

    public ParsedTask {
        body = body == null ? "" : body;
        projects = projects == null ? List.of() : List.copyOf(projects);
        contexts = contexts == null ? List.of() : List.copyOf(contexts);
        extras = extras == null
                ? Map.of()
                : Collections.unmodifiableMap(new LinkedHashMap<>(extras));
        raw = raw == null ? "" : raw;
    }
}