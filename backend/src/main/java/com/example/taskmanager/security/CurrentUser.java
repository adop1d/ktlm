package com.example.taskmanager.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Resuelve el userId del llamante desde los details de la autenticación.
 * Ya no reparsea el token: JwtAuthenticationFilter lo deja en AuthenticatedUser.
 */
@Component
public class CurrentUser {

    /** @throws ResponseStatusException 401 si no hay un userId resoluble */
    public Long id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getDetails() instanceof AuthenticatedUser details && details.userId() != null) {
            return details.userId();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user id");
    }
}