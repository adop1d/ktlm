package ktm.dto;

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
     * Closed list, not free text.
     *
     * <p>With an arbitrary String, this endpoint wrote into user_roles exactly what
     * it was handed. A role the code doesn't know does nothing today, but it is a
     * client-writable field where there should be an enum: the day something reads it
     * by string comparison, that day there is an escalation.
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