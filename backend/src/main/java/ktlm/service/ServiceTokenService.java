package ktlm.service;

import ktlm.model.ServiceToken;
import ktlm.repository.ServiceTokenRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Issuing and validating service tokens.
 *
 * <p>The token is random and handed out once; only its SHA-256 stays in the database. The
 * comparison is constant-time: comparing hashes with {@code equals} leaks through the time
 * they take, and an attacker can measure that.
 */
@Service
public class ServiceTokenService {

    private final ServiceTokenRepository repository;
    private final SecureRandom random = new SecureRandom();

    public ServiceTokenService(ServiceTokenRepository repository) {
        this.repository = repository;
    }

    /** The token in the clear. The only time it is seen. */
    public record IssuedToken(ServiceToken token, String plainToken) {}

    @Transactional
    public IssuedToken issue(Long userId, String label) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String plain = "ktlm_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        ServiceToken token = new ServiceToken();
        token.setUserId(userId);
        token.setLabel(label);
        token.setTokenHash(hash(plain));
        return new IssuedToken(repository.save(token), plain);
    }

    /** The user a token belongs to, if it is still alive. */
    @Transactional
    public Optional<ServiceToken> resolve(String plainToken) {
        if (plainToken == null || plainToken.isBlank()) {
            return Optional.empty();
        }
        Optional<ServiceToken> found = repository.findByTokenHashAndRevokedAtIsNull(hash(plainToken));
        found.ifPresent(token -> {
            token.setLastUsedAt(LocalDateTime.now());
            repository.save(token);
        });
        return found;
    }

    @Transactional
    public boolean revoke(Long userId, UUID id) {
        return repository.findByIdAndUserId(id, userId)
                .filter(ServiceToken::isUsable)
                .map(token -> {
                    token.setRevokedAt(LocalDateTime.now());
                    repository.save(token);
                    return true;
                })
                .orElse(false);
    }

    @Transactional
    public void revokeAll(Long userId) {
        List<ServiceToken> tokens = repository.findByUserIdOrderByCreatedAtDesc(userId);
        tokens.stream().filter(ServiceToken::isUsable).forEach(token -> {
            token.setRevokedAt(LocalDateTime.now());
            repository.save(token);
        });
    }

    public List<ServiceToken> list(Long userId) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    private static String hash(String plain) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(plain.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible", e);
        }
    }
}