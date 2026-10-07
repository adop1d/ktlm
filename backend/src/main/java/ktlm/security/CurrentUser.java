package ktlm.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Resolves the caller's userId from the authentication details.
 * No reparsing of the token: JwtAuthenticationFilter leaves it in AuthenticatedUser.
 */
@Component
public class CurrentUser {

    /** @throws ResponseStatusException 401 when there is no resolvable userId */
    public Long id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getDetails() instanceof AuthenticatedUser details && details.userId() != null) {
            return details.userId();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "No authenticated user id");
    }
}