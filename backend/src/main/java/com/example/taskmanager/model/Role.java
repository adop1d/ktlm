package com.example.taskmanager.model;

/**
 * Enum representing user roles in the application.
 * ROLE_USER is the default role for all registered users.
 * ROLE_ADMIN has full access to all resources.
 */
public enum Role {
    ROLE_USER("User"),
    ROLE_ADMIN("Administrator");

    private final String displayName;

    Role(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getAuthority() {
        return name();
    }
}