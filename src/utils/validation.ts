/**
 * Input Validation Utilities
 * Ensures all user inputs are validated and sanitized for security
 */

export class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validates and sanitizes a URL
 * @throws ValidationError if URL is invalid
 */
export function validateURL(input: string): URL {
  try {
    const url = new URL(input);

    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new ValidationError(
        `Invalid protocol: ${url.protocol}. Only http: and https: are allowed`,
        'url'
      );
    }

    return url;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(
      `Invalid URL format: ${input}`,
      'url'
    );
  }
}

/**
 * Validates and sanitizes a session ID
 * Only allows alphanumeric characters, hyphens, and underscores
 */
export function validateSessionId(input: string): string {
  const sanitized = input.trim();

  if (sanitized.length === 0) {
    throw new ValidationError('Session ID cannot be empty', 'sessionId');
  }

  if (sanitized.length > 100) {
    throw new ValidationError('Session ID too long (max 100 characters)', 'sessionId');
  }

  // Only allow safe characters
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new ValidationError(
      'Session ID contains invalid characters (only a-z, A-Z, 0-9, -, _ allowed)',
      'sessionId'
    );
  }

  return sanitized;
}

/**
 * Validates a numeric value is within a specified range
 */
export function validateNumber(
  value: number,
  min: number,
  max: number,
  fieldName: string
): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
  }

  if (value < min || value > max) {
    throw new ValidationError(
      `${fieldName} must be between ${min} and ${max}`,
      fieldName
    );
  }

  return value;
}

/**
 * Validates a string is not empty after trimming
 */
export function validateNonEmptyString(input: string, fieldName: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
  }

  return trimmed;
}

/**
 * Validates an error ID format
 */
export function validateErrorId(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new ValidationError('Error ID cannot be empty', 'errorId');
  }

  // Error IDs should follow the format: error-{timestamp}-{random}
  // But we'll be lenient and allow searching by partial ID or message
  if (trimmed.length > 200) {
    throw new ValidationError('Error ID too long (max 200 characters)', 'errorId');
  }

  return trimmed;
}
