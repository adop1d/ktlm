package ktlm.exception;

/** Resource missing or not visible to the authenticated user. Translated to 404. */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}