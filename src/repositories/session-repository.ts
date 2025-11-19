/**
 * Session Repository with Result-based error handling
 *
 * Provides type-safe session management using the Repository pattern.
 * All operations return Result types for explicit error handling.
 *
 * Benefits:
 * - Explicit error handling with Result types
 * - Type-safe session operations
 * - Automatic TTL-based cleanup
 * - Immutable session updates
 * - Error deduplication integrated
 * - Event emission for monitoring
 */

import type { SessionId, ErrorSession, WebError, SessionMetadata } from '../types/domain.js';
import { createErrorSession } from '../types/domain.js';
import type { Result } from '../types/result.js';
import { Ok, Err } from '../types/result.js';
import { createTTLRepository, type RepositoryError } from '../types/repository.js';
import type { IEventEmitter } from '../types/event-emitter.js';
import { createEventEmitter } from '../types/event-emitter.js';

/**
 * Session repository events
 */
export type SessionRepositoryEvents = {
  'session:created': { sessionId: SessionId; url: string };
  'session:updated': { sessionId: SessionId };
  'session:deleted': { sessionId: SessionId };
  'session:expired': { sessionId: SessionId };
  'error:added': { sessionId: SessionId; error: WebError };
  'error:deduplicated': { sessionId: SessionId; errorId: string; newFrequency: number };
} & Record<string, unknown>;

/**
 * Session-specific errors
 */
export type SessionError =
  | RepositoryError
  | { type: 'SessionExpired'; id: SessionId }
  | { type: 'DeduplicationFailed'; reason: string };

/**
 * Session Repository with event emission and Result-based operations
 */
export class SessionRepository {
  private readonly repository: ReturnType<typeof createTTLRepository<ErrorSession, SessionId>>;
  private readonly events: IEventEmitter<SessionRepositoryEvents>;

  constructor(ttlMs: number = 30 * 60 * 1000) { // 30 minutes default
    this.repository = createTTLRepository<ErrorSession, SessionId>(ttlMs);
    this.events = createEventEmitter<SessionRepositoryEvents>();
  }

  /**
   * Access to event emitter for monitoring
   */
  get eventEmitter(): IEventEmitter<SessionRepositoryEvents> {
    return this.events;
  }

  /**
   * Creates a new session
   * Returns Ok(sessionId) if successful
   */
  async createSession(
    url: string,
    metadata: SessionMetadata,
    sessionId?: SessionId
  ): Promise<Result<SessionId, SessionError>> {
    const session = createErrorSession(url, metadata, sessionId);

    const result = await this.repository.add(session);

    if (result.ok) {
      await this.events.emit('session:created', {
        sessionId: session.id,
        url
      });
      return Ok(session.id);
    }

    return result;
  }

  /**
   * Gets a session by ID
   * Returns Ok(session) if found, Err if not found or expired
   */
  async getSession(id: SessionId): Promise<Result<ErrorSession, SessionError>> {
    const result = await this.repository.get(id);

    if (!result.ok && result.error.type === 'NotFound') {
      // Session may have expired
      await this.events.emit('session:expired', { sessionId: id });
    }

    return result;
  }

  /**
   * Gets all active sessions
   */
  async getAllSessions(): Promise<Result<readonly ErrorSession[], SessionError>> {
    return await this.repository.getAll();
  }

  /**
   * Updates a session with partial updates
   * Returns Ok(session) if successful
   */
  async updateSession(
    id: SessionId,
    updates: Partial<ErrorSession>
  ): Promise<Result<ErrorSession, SessionError>> {
    const currentResult = await this.repository.get(id);

    if (!currentResult.ok) {
      return currentResult;
    }

    const updated = { ...currentResult.value, ...updates };
    const updateResult = await this.repository.update(id, updated);

    if (updateResult.ok) {
      await this.events.emit('session:updated', { sessionId: id });
    }

    return updateResult;
  }

  /**
   * Adds an error to a session with automatic deduplication
   * Returns Ok(session) if successful
   */
  async addError(
    sessionId: SessionId,
    error: WebError
  ): Promise<Result<ErrorSession, SessionError>> {
    const currentResult = await this.repository.get(sessionId);

    if (!currentResult.ok) {
      return currentResult;
    }

    const current = currentResult.value;

    try {
      // Use deduplication to merge errors by fingerprint
      const { mergeError } = await import('../services/error-deduplication.js');
      const updatedErrors = mergeError(current.errors, error);

      // Check if error was deduplicated (same length means merged)
      const wasDeduplicated = updatedErrors.length === current.errors.length;

      const updated = { ...current, errors: updatedErrors };
      const updateResult = await this.repository.update(sessionId, updated);

      if (updateResult.ok) {
        if (wasDeduplicated) {
          // Find the merged error to get new frequency
          const mergedError = updatedErrors.find(e => e.id === error.id);
          if (mergedError) {
            await this.events.emit('error:deduplicated', {
              sessionId,
              errorId: error.id,
              newFrequency: mergedError.frequency
            });
          }
        } else {
          await this.events.emit('error:added', {
            sessionId,
            error
          });
        }
      }

      return updateResult;
    } catch (err) {
      return Err({
        type: 'DeduplicationFailed',
        reason: err instanceof Error ? err.message : String(err)
      });
    }
  }

  /**
   * Deletes a session
   * Returns Ok(true) if successful
   */
  async deleteSession(id: SessionId): Promise<Result<boolean, SessionError>> {
    const result = await this.repository.delete(id);

    if (result.ok) {
      await this.events.emit('session:deleted', { sessionId: id });
    }

    return result;
  }

  /**
   * Checks if a session exists
   */
  async sessionExists(id: SessionId): Promise<Result<boolean, SessionError>> {
    return await this.repository.exists(id);
  }

  /**
   * Gets count of active sessions
   */
  async getSessionCount(): Promise<Result<number, SessionError>> {
    return await this.repository.count();
  }

  /**
   * Finds sessions matching a predicate
   */
  async findSessions(
    predicate: (session: ErrorSession) => boolean
  ): Promise<Result<readonly ErrorSession[], SessionError>> {
    return await this.repository.find(predicate);
  }

  /**
   * Clears all sessions
   */
  async clearAllSessions(): Promise<Result<boolean, SessionError>> {
    return await this.repository.clear();
  }

  /**
   * Destroys the repository and stops cleanup
   */
  destroy(): void {
    this.repository.destroy();
    this.events.removeAllListeners();
  }
}

/**
 * Factory function to create a session repository
 *
 * @param ttlMs - Session TTL in milliseconds (default: 30 minutes)
 *
 * @example
 * ```typescript
 * const repo = createSessionRepository(3600000); // 1 hour TTL
 *
 * // Create session
 * const result = await repo.createSession(url, metadata);
 * if (result.ok) {
 *   console.log('Session created:', result.value);
 * }
 *
 * // Subscribe to events
 * repo.eventEmitter.on('error:added', ({ sessionId, error }) => {
 *   console.log('Error added to session', sessionId);
 * });
 * ```
 */
export function createSessionRepository(ttlMs?: number): SessionRepository {
  return new SessionRepository(ttlMs);
}
