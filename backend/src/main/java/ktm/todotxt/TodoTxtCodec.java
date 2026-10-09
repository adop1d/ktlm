package ktm.todotxt;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pure codec for the todo.txt dialect spoken by the {@code tuxedo} TUI.
 *
 * <p>No state, no dependencies: {@link #parse(String)} and
 * {@link #serialize(List)} are exact inverses over well-formed input.
 */
@Component
public class TodoTxtCodec {

    private static final Pattern PRIORITY = Pattern.compile("^\\(([A-Za-z])\\)$");
    private static final Pattern DATE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

    private static final String KEY_DUE = "due";
    private static final String KEY_REC = "rec";
    private static final String KEY_T = "t";
    private static final String KEY_UID = "uid";

    /**
     * Parses a whole todo.txt document.
     *
     * <p>Blank lines and {@code #} comments are skipped, matching both the todo.txt
     * convention and tuxedo's own inbox drain.
     *
     * @return one {@link ParsedTask} per remaining line, in file order (never null)
     */
    public List<ParsedTask> parse(String body) {
        List<ParsedTask> tasks = new ArrayList<>();
        if (body == null || body.isBlank()) {
            return List.copyOf(tasks);
        }
        for (String line : body.split("\\R")) {
            ParsedTask task = parseLine(line);
            if (task != null) {
                tasks.add(task);
            }
        }
        return List.copyOf(tasks);
    }

    private ParsedTask parseLine(String line) {
        String raw = line;
        String trimmed = line.trim();
        if (trimmed.isEmpty() || trimmed.startsWith("#")) {
            return null;
        }

        List<String> tokens = new ArrayList<>();
        for (String token : trimmed.split("\\s+")) {
            if (!token.isEmpty()) {
                tokens.add(token);
            }
        }

        int i = 0;
        boolean done = false;
        LocalDate completed = null;
        if ("x".equals(tokens.get(i))) {
            done = true;
            i++;
            if (i < tokens.size()) {
                LocalDate maybe = date(tokens.get(i));
                if (maybe != null) {
                    completed = maybe;
                    i++;
                }
            }
        }

        Character priority = null;
        if (i < tokens.size()) {
            Matcher m = PRIORITY.matcher(tokens.get(i));
            if (m.matches()) {
                priority = Character.toUpperCase(m.group(1).charAt(0));
                i++;
            }
        }

        LocalDate created = null;
        if (i < tokens.size()) {
            LocalDate maybe = date(tokens.get(i));
            if (maybe != null) {
                created = maybe;
                i++;
            }
        }

        StringBuilder rest = new StringBuilder();
        List<String> projects = new ArrayList<>();
        List<String> contexts = new ArrayList<>();
        Map<String, String> extras = new LinkedHashMap<>();
        LocalDate due = null;
        String recurrence = null;
        String threshold = null;
        String todoUid = null;

        for (; i < tokens.size(); i++) {
            String token = tokens.get(i);

            // A tag glued to another word is not one: tuxedo requires the sigil as a token
            // of its own.
            if (token.length() > 1 && token.charAt(0) == '+') {
                projects.add(token.substring(1));
                continue;
            }
            if (token.length() > 1 && token.charAt(0) == '@') {
                contexts.add(token.substring(1));
                continue;
            }

            int colon = token.indexOf(':');
            // A token with an empty key or empty value is ordinary text, not a
            // tag; that keeps "http://x" and "foo:" intact instead of eating them.
            if (colon > 0 && colon < token.length() - 1) {
                String key = token.substring(0, colon);
                String value = token.substring(colon + 1);
                switch (key) {
                    case KEY_DUE -> {
                        LocalDate parsed = date(value);
                        if (parsed == null) {
                            // not ISO: dropped from the text, never an extra
                            continue;
                        }
                        due = parsed;
                        continue;
                    }
                    case KEY_REC -> {
                        recurrence = value;
                        continue;
                    }
                    case KEY_T -> {
                        threshold = value;
                        continue;
                    }
                    case KEY_UID -> {
                        todoUid = value;
                        continue;
                    }
                    default -> {
                        extras.put(key, value);
                        continue;
                    }
                }
            }

            if (!rest.isEmpty()) {
                rest.append(' ');
            }
            rest.append(token);
        }

        return new ParsedTask(priority, created, rest.toString(), projects, contexts,
                due, recurrence, threshold, done, completed, todoUid, extras, raw);
    }

    /**
     * Renders tasks back to todo.txt in the canonical tuxedo field order. Every
     * line (including the last) ends with {@code \n}; an empty list renders "".
     */
    public String serialize(List<ParsedTask> tasks) {
        if (tasks == null || tasks.isEmpty()) {
            return "";
        }
        StringBuilder out = new StringBuilder();
        for (ParsedTask task : tasks) {
            if (task == null) {
                continue;
            }
            if (task.done()) {
                append(out, "x");
                if (task.completed() != null) {
                    append(out, task.completed().toString());
                }
            }
            if (task.priority() != null) {
                append(out, "(" + Character.toUpperCase(task.priority()) + ")");
            }
            if (task.created() != null) {
                append(out, task.created().toString());
            }
            String body = task.body() == null ? "" : task.body().trim();
            if (!body.isEmpty()) {
                append(out, body);
            }
            for (String project : safe(task.projects())) {
                if (!project.isBlank()) {
                    append(out, "+" + project);
                }
            }
            for (String context : safe(task.contexts())) {
                if (!context.isBlank()) {
                    append(out, "@" + context);
                }
            }
            if (task.due() != null) {
                append(out, KEY_DUE + ":" + task.due());
            }
            append(out, valued(KEY_REC, task.recurrence()));
            append(out, valued(KEY_T, task.threshold()));
            if (task.extras() != null) {
                for (Map.Entry<String, String> extra : task.extras().entrySet()) {
                    if (extra.getKey() == null || extra.getKey().isEmpty()
                            || extra.getValue() == null || extra.getValue().isEmpty()) {
                        continue;
                    }
                    if (KEY_DUE.equals(extra.getKey()) || KEY_REC.equals(extra.getKey())
                            || KEY_T.equals(extra.getKey()) || KEY_UID.equals(extra.getKey())) {
                        continue;
                    }
                    append(out, extra.getKey() + ":" + extra.getValue());
                }
            }
            append(out, valued(KEY_UID, task.todoUid()));
            out.append('\n');
        }
        return out.toString();
    }

    private static String valued(String key, String value) {
        return value == null || value.isEmpty() ? null : key + ":" + value;
    }

    private static void append(StringBuilder out, String token) {
        if (token == null || token.isEmpty()) {
            return;
        }
        // a space joins tokens within a line, never right after a line break
        if (!out.isEmpty() && out.charAt(out.length() - 1) != '\n') {
            out.append(' ');
        }
        out.append(token);
    }

    private static List<String> safe(List<String> values) {
        return values == null ? List.of() : values;
    }

    /** @return the ISO date, or null when the token is not a strict {@code YYYY-MM-DD} date */
    private static LocalDate date(String token) {
        if (token == null || !DATE.matcher(token).matches()) {
            return null;
        }
        try {
            return LocalDate.parse(token);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}