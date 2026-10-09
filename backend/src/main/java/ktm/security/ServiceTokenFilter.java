package ktm.security;

import ktm.model.ServiceToken;
import ktm.service.ServiceTokenService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Authenticates requests with a service token, in the
 * {@code Authorization: Service <token>} header.
 *
 * <p>It runs before the JWT filter and, if there is no service token, lets it through so
 * the JWT one can do its job: two ways into the same door, not two doors.
 *
 * <p>The authority is ROLE_MCP. The endpoints that are done by hand —archiving— do not
 * accept it, so an automation cannot do what was decided it must not do even if it
 * carries a valid token.
 */
@Component
public class ServiceTokenFilter extends OncePerRequestFilter {

    private static final String PREFIX = "Service ";

    private final ServiceTokenService tokens;

    public ServiceTokenFilter(ServiceTokenService tokens) {
        this.tokens = tokens;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith(PREFIX)
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            tokens.resolve(header.substring(PREFIX.length()).trim())
                    .ifPresent(token -> authenticate(request, token));
        }
        chain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, ServiceToken token) {
        ServiceTokenPrincipal principal = new ServiceTokenPrincipal(token.getUserId(), token.getLabel());
        var authentication = new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_MCP")));
        authentication.setDetails(new AuthenticatedUser(token.getUserId()));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        request.setAttribute(ServiceTokenPrincipal.ATTRIBUTE, principal);
    }

    /** Service token identity on the request, so we can audit who did what. */
    public record ServiceTokenPrincipal(Long userId, String label) {
        public static final String ATTRIBUTE = "serviceToken";
    }
}