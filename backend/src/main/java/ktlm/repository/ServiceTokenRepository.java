package ktlm.repository;

import ktlm.model.ServiceToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ServiceTokenRepository extends JpaRepository<ServiceToken, UUID> {

    Optional<ServiceToken> findByTokenHashAndRevokedAtIsNull(String tokenHash);

    Optional<ServiceToken> findByIdAndUserId(UUID id, Long userId);

    List<ServiceToken> findByUserIdOrderByCreatedAtDesc(Long userId);
}