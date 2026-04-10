package com.example.taskmanager.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Request DTO for assigning roles to users.
 */
public class RoleAssignmentRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotNull(message = "Role is required")
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