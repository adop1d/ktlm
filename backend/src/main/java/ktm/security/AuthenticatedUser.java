package ktm.security;

/**
 * Authentication details: carries the userId extracted from the JWT so controllers do
 * not have to reparse the token out of getCredentials().
 */
public record AuthenticatedUser(Long userId) {}