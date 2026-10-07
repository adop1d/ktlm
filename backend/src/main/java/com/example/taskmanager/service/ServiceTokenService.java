package com.example.taskmanager.service;

import com.example.taskmanager.model.ServiceToken;
import com.example.taskmanager.repository.ServiceTokenRepository;
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
 * Emisión y comprobación de tokens de servicio.
 *
 * <p>El token es aleatorio y se entrega una sola vez; en la base solo queda su SHA-256. La
 * comparación es en tiempo constante: comparar hashes con {@code equals} filtra por el tiempo
 * que tardan, y un atacante puede medir eso.
 */
@Service
public class ServiceTokenService {

    private final ServiceTokenRepository repository;
    private final SecureRandom random = new SecureRandom();

    public ServiceTokenService(ServiceTokenRepository repository) {
        this.repository = repository;
    }

    /** El token en claro. Es la única vez que se ve. */
    public record IssuedToken(ServiceToken token, String plainToken) {}

    @Transactional
    public IssuedToken issue(Long userId, String label) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String plain = "ktm_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        ServiceToken token = new ServiceToken();
        token.setUserId(userId);
        token.setLabel(label);
        token.setTokenHash(hash(plain));
        return new IssuedToken(repository.save(token), plain);
    }

    /** El usuario al que pertenece un token, si sigue vivo. */
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