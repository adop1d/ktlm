package ktlm.exception;

/** Petición sintácticamente válida pero semánticamente imposible. Se traduce a 400. */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}