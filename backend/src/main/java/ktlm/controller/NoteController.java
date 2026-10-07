package ktlm.controller;

import ktlm.security.CurrentUser;
import ktlm.service.NoteService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * The note text of a task.
 *
 * <p>The file line only carries the path —`note:notas/nota-12.md`—, so the content
 * goes separately. Separately because the path is a token and the content does not fit
 * in one.
 */
@RestController
@RequestMapping("/api/tasks")
public class NoteController {

    private final NoteService notes;
    private final CurrentUser currentUser;

    public NoteController(NoteService notes, CurrentUser currentUser) {
        this.notes = notes;
        this.currentUser = currentUser;
    }

    @GetMapping(value = "/{id}/note", produces = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<String> read(@PathVariable Long id) {
        return ResponseEntity.ok(notes.read(currentUser.id(), id));
    }

    /** Emptying the content deletes the file and drops the `note:` token from the line. */
    @PutMapping(value = "/{id}/note", consumes = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<Map<String, Object>> write(@PathVariable Long id, @RequestBody String contenido) {
        notes.write(currentUser.id(), id, contenido);
        return ResponseEntity.ok(Map.of("ok", true, "vacia", contenido == null || contenido.isBlank()));
    }
}