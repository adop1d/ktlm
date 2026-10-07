package ktlm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Request DTO for assigning roles to users.
 */
public class RoleAssignmentRequest {

    @NotBlank(message = "Username is required")
    private String username;

    /**
     * Lista cerrada, no texto libre.
     *
     * <p>Con un String cualquiera, este endpoint escribía en user_roles exactamente lo que
     * le mandaran. Un rol que el código no conoce no hace nada hoy, pero es un dato
     * escribible por el cliente donde debería haber un enum: el día que algo lo lea por
     * comparación de cadenas, ese día hay una escalada.
     */
    @NotNull(message = "Role is required")
    @Pattern(regexp = "ROLE_(USER|ADMIN|MCP)", message = "Role must be ROLE_USER, ROLE_ADMIN or ROLE_MCP")
    private String role;

    public RoleAssignmentRequest() {}

    public RoleAssignmentRequest(String username, String role) {
        this.username = username;
        this.role = role;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}