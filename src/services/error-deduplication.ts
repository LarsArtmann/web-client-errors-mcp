/**
 * Error Deduplication Service
 * Implements fingerprint-based error grouping to prevent duplicate storage
 * and track error frequency accurately
 */

import type { WebError, JavaScriptError, NetworkError, ResourceError } from '../types/domain.js';
import { getAppLogger } from '../logger.js';

const logger = getAppLogger('error-deduplication');

/**
 * Generates a unique fingerprint for an error based on its characteristics
 * Used to identify duplicate errors across the session
 */
export function generateErrorFingerprint(error: WebError): string {
  switch (error.type) {
    case 'javascript': {
      const jsError = error as JavaScriptError;
      // Fingerprint: type + message + first stack frame (same error, same location)
      const firstStackLine = jsError.stack.split('\n')[0]?.trim() || '';
      return `${error.type}:${normalizeMessage(error.message)}:${firstStackLine}`;
    }

    case 'network': {
      const netError = error as NetworkError;
      // Fingerprint: type + url + status code (same endpoint, same failure)
      return `${error.type}:${normalizeURL(netError.url)}:${netError.statusCode}`;
    }

    case 'resource': {
      const resError = error as ResourceError;
      // Fingerprint: type + url + status code
      return `${error.type}:${normalizeURL(resError.url)}:${resError.statusCode}`;
    }

    case 'console':
      // Fingerprint: type + message (console errors are typically unique)
      return `${error.type}:${normalizeMessage(error.message)}`;

    case 'performance':
      // Fingerprint: type + metric (same metric failure)
      return `${error.type}:${error.metric}`;

    case 'security':
      // Fingerprint: type + violation (same security violation)
      return `${error.type}:${error.violation}`;

    default: {
      // Fallback: type + message
      // This should never happen if all WebError types are handled above
      const unknownError = error as WebError;
      return `${unknownError.type}:${normalizeMessage(unknownError.message)}`;
    }
  }
}

/**
 * Normalizes error message for consistent fingerprinting
 * Removes dynamic parts like timestamps, IDs, random values
 */
function normalizeMessage(message: string): string {
  return message
    // Remove timestamps: 2024-01-15T12:34:56.789Z
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z?/g, '<TIMESTAMP>')
    // Remove numeric IDs: id=12345, id:67890
    .replace(/\b(id|ID|Id)[=:]\s*\d+/g, '<ID>')
    // Remove random strings: abc123def456
    .replace(/\b[a-f0-9]{8,}\b/gi, '<HASH>')
    // Remove line:column references: at script.js:42:15
    .replace(/:\d+:\d+/g, ':<LINE>:<COL>')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes URL for consistent fingerprinting
 * Removes query parameters and fragments that might vary
 */
function normalizeURL(url: string): string {
  try {
    const parsed = new URL(url);
    // Keep protocol + host + pathname, remove query and hash
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    // If URL parsing fails, just use the original
    return url;
  }
}

/**
 * Deduplicates an array of errors by fingerprint
 * Returns deduplicated errors with accurate frequency counts
 */
export function deduplicateErrors(errors: readonly WebError[]): WebError[] {
  const fingerprintMap = new Map<string, WebError>();

  for (const error of errors) {
    const fingerprint = generateErrorFingerprint(error);
    const existing = fingerprintMap.get(fingerprint);

    if (existing) {
      // Increment frequency on existing error
      const updated: WebError = {
        ...existing,
        frequency: existing.frequency + 1,
        // Keep the earliest timestamp
        timestamp: existing.timestamp < error.timestamp ? existing.timestamp : error.timestamp
      };
      fingerprintMap.set(fingerprint, updated);

      logger.debug('Deduplicated error', {
        fingerprint,
        newFrequency: updated.frequency,
        type: error.type
      });
    } else {
      // First occurrence - add to map
      fingerprintMap.set(fingerprint, error);
    }
  }

  // Return deduplicated errors sorted by frequency (most common first)
  return Array.from(fingerprintMap.values())
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Finds a duplicate error in an array by fingerprint
 * Returns the index of the duplicate, or -1 if not found
 */
export function findDuplicateError(
  errors: readonly WebError[],
  newError: WebError
): number {
  const newFingerprint = generateErrorFingerprint(newError);

  return errors.findIndex(error => {
    return generateErrorFingerprint(error) === newFingerprint;
  });
}

/**
 * Merges a new error into an existing error array with deduplication
 * If duplicate exists, increments frequency; otherwise adds new error
 * Returns updated error array
 */
export function mergeError(
  errors: readonly WebError[],
  newError: WebError
): WebError[] {
  const duplicateIndex = findDuplicateError(errors, newError);

  if (duplicateIndex !== -1) {
    // Duplicate found - increment frequency
    const existing = errors[duplicateIndex];
    const updated: WebError = {
      ...existing,
      frequency: existing.frequency + 1,
      // Keep the earliest timestamp
      timestamp: existing.timestamp < newError.timestamp ? existing.timestamp : newError.timestamp
    };

    // Replace the existing error with updated one
    const updatedErrors = [...errors];
    updatedErrors[duplicateIndex] = updated;

    logger.debug('Merged duplicate error', {
      type: newError.type,
      newFrequency: updated.frequency,
      fingerprint: generateErrorFingerprint(newError)
    });

    return updatedErrors;
  } else {
    // Not a duplicate - add new error
    logger.debug('Added new unique error', {
      type: newError.type,
      fingerprint: generateErrorFingerprint(newError)
    });

    return [...errors, newError];
  }
}

/**
 * Gets error statistics for a session
 */
export function getErrorStats(errors: readonly WebError[]): {
  total: number;
  unique: number;
  byType: Record<string, number>;
  topErrors: Array<{ fingerprint: string; frequency: number; type: string }>;
} {
  const fingerprintMap = new Map<string, { frequency: number; type: string }>();

  for (const error of errors) {
    const fingerprint = generateErrorFingerprint(error);
    const existing = fingerprintMap.get(fingerprint);

    if (existing) {
      existing.frequency += error.frequency;
    } else {
      fingerprintMap.set(fingerprint, {
        frequency: error.frequency,
        type: error.type
      });
    }
  }

  const byType: Record<string, number> = {};
  for (const error of errors) {
    byType[error.type] = (byType[error.type] || 0) + error.frequency;
  }

  const topErrors = Array.from(fingerprintMap.entries())
    .map(([fingerprint, { frequency, type }]) => ({ fingerprint, frequency, type }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10);

  return {
    total: errors.reduce((sum, err) => sum + err.frequency, 0),
    unique: fingerprintMap.size,
    byType,
    topErrors
  };
}
