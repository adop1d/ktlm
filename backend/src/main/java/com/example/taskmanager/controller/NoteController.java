package com.example.taskmanager.controller;

import com.example.taskmanager.security.CurrentUser;
import com.example.taskmanager.service.NoteService;
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
 * El texto de la nota de una tarea.
 *
 * <p>La línea del archivo solo lleva la ruta —`note:notas/nota-12.md`—, así que el
 * contenido va aparte. Va aparte porque la ruta es un token y el contenido no cabe en uno.
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

    /** Vaciar el contenido borra el archivo y quita el token `note:` de la línea. */
    @PutMapping(value = "/{id}/note", consumes = MediaType.TEXT_PLAIN_VALUE)
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN', 'ROLE_MCP')")
    public ResponseEntity<Map<String, Object>> write(@PathVariable Long id, @RequestBody String contenido) {
        notes.write(currentUser.id(), id, contenido);
        return ResponseEntity.ok(Map.of("ok", true, "vacia", contenido == null || contenido.isBlank()));
    }
}