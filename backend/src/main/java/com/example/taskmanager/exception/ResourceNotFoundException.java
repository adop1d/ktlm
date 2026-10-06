package com.example.taskmanager.exception;

/** Recurso ausente o no visible para el usuario autenticado. Se traduce a 404. */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}