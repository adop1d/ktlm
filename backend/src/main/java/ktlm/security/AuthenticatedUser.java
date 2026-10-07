package ktlm.security;

/**
 * Details de la autenticación: transporta el userId extraído del JWT para que los
 * controladores no tengan que reparsear el token desde getCredentials().
 */
public record AuthenticatedUser(Long userId) {}