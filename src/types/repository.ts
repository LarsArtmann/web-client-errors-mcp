/**
 * Generic Repository Pattern
 *
 * Provides type-safe, immutable data access with Result-based error handling.
 * Enforces clean separation between data access and business logic.
 *
 * Benefits:
 * - Type safety across all CRUD operations
 * - Immutability enforced at repository level
 * - Consistent error handling with Result types
 * - Easy to mock for testing
 * - Single responsibility (data access only)
 * - Generic implementation reduces code duplication
 *
 * @example
 * ```typescript
 * interface User {
 *   readonly id: string;
 *   readonly name: string;
 * }
 *
 * const userRepo = createInMemoryRepository<User, string>();
 * await userRepo.add({ id: '1', name: 'Alice' });
 * const user = await userRepo.get('1');
 * ```
 */

import type { Result } from './result.js';
import { Ok, Err } from './result.js';

/**
 * Repository error types
 */
export type RepositoryError =
  | { type: 'NotFound'; id: string }
  | { type: 'AlreadyExists'; id: string }
  | { type: 'InvalidData'; reason: string }
  | { type: 'StorageError'; message: string };

/**
 * Creates a NotFound error
 */
export function notFound(id: string): RepositoryError {
  return { type: 'NotFound', id };
}

/**
 * Creates an AlreadyExists error
 */
export function alreadyExists(id: string): RepositoryError {
  return { type: 'AlreadyExists', id };
}

/**
 * Creates an InvalidData error
 */
export function invalidData(reason: string): RepositoryError {
  return { type: 'InvalidData', reason };
}

/**
 * Creates a StorageError
 */
export function storageError(message: string): RepositoryError {
  return { type: 'StorageError', message };
}

/**
 * Generic Repository interface
 * T: Entity type
 * ID: ID type (string, number, branded type, etc.)
 */
export interface IRepository<T, ID> {
  /**
   * Gets an entity by ID
   * Returns Ok(entity) if found, Err(NotFound) if not found
   */
  get(id: ID): Promise<Result<T, RepositoryError>>;

  /**
   * Gets all entities
   * Returns Ok(entities) or Err(StorageError)
   */
  getAll(): Promise<Result<readonly T[], RepositoryError>>;

  /**
   * Adds a new entity
   * Returns Ok(entity) if successful, Err(AlreadyExists) if ID exists
   */
  add(entity: T): Promise<Result<T, RepositoryError>>;

  /**
   * Updates an existing entity
   * Returns Ok(entity) if successful, Err(NotFound) if not found
   */
  update(id: ID, entity: T): Promise<Result<T, RepositoryError>>;

  /**
   * Deletes an entity by ID
   * Returns Ok(true) if successful, Err(NotFound) if not found
   */
  delete(id: ID): Promise<Result<boolean, RepositoryError>>;

  /**
   * Checks if an entity exists
   * Returns Ok(true/false) or Err(StorageError)
   */
  exists(id: ID): Promise<Result<boolean, RepositoryError>>;

  /**
   * Counts total entities
   * Returns Ok(count) or Err(StorageError)
   */
  count(): Promise<Result<number, RepositoryError>>;

  /**
   * Finds entities matching a predicate
   * Returns Ok(entities) or Err(StorageError)
   */
  find(predicate: (entity: T) => boolean): Promise<Result<readonly T[], RepositoryError>>;

  /**
   * Clears all entities
   * Returns Ok(true) or Err(StorageError)
   */
  clear(): Promise<Result<boolean, RepositoryError>>;
}

/**
 * In-memory implementation of IRepository
 * Uses Map for O(1) lookups
 * Enforces immutability by freezing entities
 */
export class InMemoryRepository<T extends { readonly id: ID }, ID> implements IRepository<T, ID> {
  private readonly store: Map<ID, T>;

  constructor() {
    this.store = new Map();
  }

  async get(id: ID): Promise<Result<T, RepositoryError>> {
    const entity = this.store.get(id);
    if (entity === undefined) {
      return Err(notFound(String(id)));
    }
    return Ok(entity);
  }

  async getAll(): Promise<Result<readonly T[], RepositoryError>> {
    return Ok(Array.from(this.store.values()));
  }

  async add(entity: T): Promise<Result<T, RepositoryError>> {
    if (this.store.has(entity.id)) {
      return Err(alreadyExists(String(entity.id)));
    }

    // Freeze entity to enforce immutability
    const frozen = Object.freeze({ ...entity });
    this.store.set(entity.id, frozen);
    return Ok(frozen);
  }

  async update(id: ID, entity: T): Promise<Result<T, RepositoryError>> {
    if (!this.store.has(id)) {
      return Err(notFound(String(id)));
    }

    // Freeze entity to enforce immutability
    const frozen = Object.freeze({ ...entity });
    this.store.set(id, frozen);
    return Ok(frozen);
  }

  async delete(id: ID): Promise<Result<boolean, RepositoryError>> {
    if (!this.store.has(id)) {
      return Err(notFound(String(id)));
    }

    this.store.delete(id);
    return Ok(true);
  }

  async exists(id: ID): Promise<Result<boolean, RepositoryError>> {
    return Ok(this.store.has(id));
  }

  async count(): Promise<Result<number, RepositoryError>> {
    return Ok(this.store.size);
  }

  async find(predicate: (entity: T) => boolean): Promise<Result<readonly T[], RepositoryError>> {
    const results = Array.from(this.store.values()).filter(predicate);
    return Ok(results);
  }

  async clear(): Promise<Result<boolean, RepositoryError>> {
    this.store.clear();
    return Ok(true);
  }
}

/**
 * Factory function to create an in-memory repository
 * Provides better type inference than using 'new'
 *
 * @example
 * ```typescript
 * interface Session { readonly id: SessionId; readonly errors: readonly WebError[] }
 * const repo = createInMemoryRepository<Session, SessionId>();
 * ```
 */
export function createInMemoryRepository<T extends { readonly id: ID }, ID>(): IRepository<T, ID> {
  return new InMemoryRepository<T, ID>();
}

/**
 * Repository with TTL (Time-To-Live) support
 * Automatically removes expired entities
 */
export class TTLRepository<T extends { readonly id: ID }, ID> implements IRepository<T, ID> {
  private readonly store: Map<ID, { entity: T; expiresAt: number }>;
  private readonly ttlMs: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(ttlMs: number = 3600000) { // Default: 1 hour
    this.store = new Map();
    this.ttlMs = ttlMs;
    this.startCleanup();
  }

  private startCleanup(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      this.removeExpired();
    }, 60000);
  }

  private removeExpired(): void {
    const now = Date.now();
    const toDelete: ID[] = [];

    for (const [id, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.store.delete(id);
    }
  }

  async get(id: ID): Promise<Result<T, RepositoryError>> {
    const entry = this.store.get(id);
    if (entry === undefined) {
      return Err(notFound(String(id)));
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(id);
      return Err(notFound(String(id)));
    }

    return Ok(entry.entity);
  }

  async getAll(): Promise<Result<readonly T[], RepositoryError>> {
    this.removeExpired();
    return Ok(Array.from(this.store.values()).map(entry => entry.entity));
  }

  async add(entity: T): Promise<Result<T, RepositoryError>> {
    if (this.store.has(entity.id)) {
      return Err(alreadyExists(String(entity.id)));
    }

    const frozen = Object.freeze({ ...entity });
    this.store.set(entity.id, {
      entity: frozen,
      expiresAt: Date.now() + this.ttlMs
    });
    return Ok(frozen);
  }

  async update(id: ID, entity: T): Promise<Result<T, RepositoryError>> {
    if (!this.store.has(id)) {
      return Err(notFound(String(id)));
    }

    const frozen = Object.freeze({ ...entity });
    this.store.set(id, {
      entity: frozen,
      expiresAt: Date.now() + this.ttlMs // Reset TTL on update
    });
    return Ok(frozen);
  }

  async delete(id: ID): Promise<Result<boolean, RepositoryError>> {
    if (!this.store.has(id)) {
      return Err(notFound(String(id)));
    }

    this.store.delete(id);
    return Ok(true);
  }

  async exists(id: ID): Promise<Result<boolean, RepositoryError>> {
    const entry = this.store.get(id);
    if (entry === undefined) {
      return Ok(false);
    }

    // Check if expired
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(id);
      return Ok(false);
    }

    return Ok(true);
  }

  async count(): Promise<Result<number, RepositoryError>> {
    this.removeExpired();
    return Ok(this.store.size);
  }

  async find(predicate: (entity: T) => boolean): Promise<Result<readonly T[], RepositoryError>> {
    this.removeExpired();
    const results = Array.from(this.store.values())
      .map(entry => entry.entity)
      .filter(predicate);
    return Ok(results);
  }

  async clear(): Promise<Result<boolean, RepositoryError>> {
    this.store.clear();
    return Ok(true);
  }

  /**
   * Stops the cleanup interval
   * Call this when shutting down the repository
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }
}

/**
 * Creates a TTL-based repository
 *
 * @param ttlMs - Time to live in milliseconds (default: 1 hour)
 *
 * @example
 * ```typescript
 * const repo = createTTLRepository<Session, SessionId>(3600000); // 1 hour TTL
 * ```
 */
export function createTTLRepository<T extends { readonly id: ID }, ID>(
  ttlMs: number = 3600000
): TTLRepository<T, ID> {
  return new TTLRepository<T, ID>(ttlMs);
}
