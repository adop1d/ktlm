package ktlm.controller;

import ktlm.security.CurrentUser;
import ktlm.service.ServiceTokenService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Creating and revoking service tokens.
 *
 * <p>Requires a normal session: a service token cannot create more service tokens, or
 * one would be enough to escalate privileges indefinitely.
 */
@RestController
@RequestMapping("/api/auth/service-tokens")
public class ServiceTokenController {

    private final ServiceTokenService tokens;
    private final CurrentUser currentUser;

    public ServiceTokenController(ServiceTokenService tokens, CurrentUser currentUser) {
        this.tokens = tokens;
        this.currentUser = currentUser;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public List<Map<String, Object>> list() {
        return tokens.list(currentUser.id()).stream()
                .map(token -> Map.<String, Object>of(
                        "id", token.getId().toString(),
                        "label", token.getLabel(),
                        "createdAt", token.getCreatedAt().toString(),
                        "lastUsedAt", token.getLastUsedAt() == null ? "" : token.getLastUsedAt().toString(),
                        "usable", token.isUsable()))
                .toList();
    }

    /** The plain token is returned here and nowhere else. */
    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public ResponseEntity<Map<String, Object>> issue(@RequestBody Map<String, String> body) {
        String label = body.getOrDefault("label", "sin nombre").trim();
        if (label.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "label es obligatorio"));
        }
        var issued = tokens.issue(currentUser.id(), label);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", issued.token().getId().toString(),
                "label", issued.token().getLabel(),
                "token", issued.plainToken(),
                "aviso", "Cópialo ahora: no se vuelve a mostrar."));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_USER', 'ROLE_ADMIN')")
    public ResponseEntity<Void> revoke(@PathVariable UUID id) {
        return tokens.revoke(currentUser.id(), id)
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }
}