package com.aureus.aureus.exception;

/**
 * Raised when a requested money movement violates a configured
 * transaction amount or destination wallet balance limit.
 */
public class LimitExceededException extends RuntimeException {

    public LimitExceededException(String message) {
        super(message);
    }
}
