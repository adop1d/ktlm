package com.example.taskmanager.security;

import com.example.taskmanager.model.ServiceToken;
import com.example.taskmanager.service.ServiceTokenService;
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
 * Autentica las peticiones con token de servicio, en la cabecera
 * {@code Authorization: Service <token>}.
 *
 * <p>Va antes que el filtro del JWT y, si no hay token de servicio, lo deja pasar para que
 * el de JWT haga su trabajo: son dos formas de entrar en la misma puerta, no dos puertas.
 *
 * <p>La autoridad es ROLE_MCP. Los endpoints que hacen falta a mano —archivar— no la
 * aceptan, así que una automatización no puede hacer lo que se decidió que no puede
 * hacer aunque lleve un token válido.
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

    /** Identidad del token de servicio en la petición, para poder auditar quién hizo qué. */
    public record ServiceTokenPrincipal(Long userId, String label) {
        public static final String ATTRIBUTE = "serviceToken";
    }
}