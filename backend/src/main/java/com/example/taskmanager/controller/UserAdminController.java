package com.example.taskmanager.controller;

import com.example.taskmanager.dto.RoleAssignmentRequest;
import com.example.taskmanager.model.User;
import com.example.taskmanager.service.UserManagementService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Admin controller for user management operations.
 * All endpoints require ROLE_ADMIN.
 */
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ROLE_ADMIN')")
public class UserAdminController {

    private final UserManagementService userManagementService;

    public UserAdminController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    /**
     * Get all users - admin only.
     */
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userManagementService.getAllUsers());
    }

    /**
     * Get user by username - admin only.
     */
    @GetMapping("/{username}")
    public ResponseEntity<User> getUserByUsername(@PathVariable String username) {
        return userManagementService.getUserByUsername(username)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Assign a role to a user - admin only.
     */
    @PostMapping("/roles")
    public ResponseEntity<User> assignRole(@Valid @RequestBody RoleAssignmentRequest request) {
        try {
            User user = userManagementService.assignRole(request);
            return ResponseEntity.ok(user);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Remove a role from a user - admin only.
     */
    @DeleteMapping("/roles")
    public ResponseEntity<User> removeRole(@Valid @RequestBody RoleAssignmentRequest request) {
        try {
            User user = userManagementService.removeRole(request);
            return ResponseEntity.ok(user);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Delete a user - admin only.
     */
    @DeleteMapping("/{username}")
    public ResponseEntity<Void> deleteUser(@PathVariable String username) {
        try {
            userManagementService.deleteUser(username);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}