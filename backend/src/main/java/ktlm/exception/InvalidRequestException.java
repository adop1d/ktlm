package ktlm.exception;

/** Request syntactically valid but semantically impossible. Translated to 400. */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}