/**
 * Rate Limiter
 *
 * Prevents abuse by limiting request frequency per client/resource.
 * Uses token bucket algorithm for smooth rate limiting.
 *
 * Benefits:
 * - Protects against DoS attacks
 * - Prevents resource exhaustion
 * - Configurable limits per endpoint
 * - Memory-efficient with automatic cleanup
 * - TypeScript-safe with branded types
 */

import type { Result } from '../types/result.js';
import { Ok, Err } from '../types/result.js';

/**
 * Rate limit error
 */
export interface RateLimitError {
  type: 'RateLimitExceeded';
  retryAfter: number; // Seconds until next allowed request
  limit: number;
  window: number; // Window size in seconds
}

/**
 * Token bucket for rate limiting
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // Tokens per second
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /**
   * Maximum requests allowed in the window
   */
  limit: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Cleanup interval in milliseconds (default: 60000 = 1 minute)
   */
  cleanupIntervalMs?: number;
}

/**
 * Rate Limiter using token bucket algorithm
 */
export class RateLimiter {
  private readonly buckets: Map<string, TokenBucket>;
  private readonly config: Required<RateLimiterConfig>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(config: RateLimiterConfig) {
    this.buckets = new Map();
    this.config = {
      ...config,
      cleanupIntervalMs: config.cleanupIntervalMs || 60000
    };
    this.startCleanup();
  }

  /**
   * Checks if a request is allowed for the given key
   * Returns Ok(true) if allowed, Err(RateLimitError) if exceeded
   *
   * @param key - Unique identifier for the client/resource (e.g., IP address, session ID)
   */
  async checkLimit(key: string): Promise<Result<boolean, RateLimitError>> {
    const bucket = this.getOrCreateBucket(key);
    const now = Date.now();

    // Refill tokens based on time elapsed
    const secondsElapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = secondsElapsed * bucket.refillRate;

    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return Ok(true);
    }

    // Rate limit exceeded
    const retryAfter = Math.ceil((1 - bucket.tokens) / bucket.refillRate);
    return Err({
      type: 'RateLimitExceeded',
      retryAfter,
      limit: this.config.limit,
      window: this.config.windowSeconds
    });
  }

  /**
   * Resets the rate limit for a specific key
   * Useful for testing or manual override
   */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /**
   * Resets all rate limits
   */
  resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Gets current token count for a key (for monitoring)
   */
  getTokens(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.config.limit;

    const now = Date.now();
    const secondsElapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = secondsElapsed * bucket.refillRate;

    return Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
  }

  /**
   * Stops the cleanup timer
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  private getOrCreateBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: this.config.limit,
        lastRefill: Date.now(),
        maxTokens: this.config.limit,
        refillRate: this.config.limit / this.config.windowSeconds
      };
      this.buckets.set(key, bucket);
    }

    return bucket;
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupIntervalMs);
  }

  private cleanup(): void {
    const now = Date.now();
    const staleThreshold = this.config.windowSeconds * 2 * 1000; // 2x window

    for (const [key, bucket] of this.buckets.entries()) {
      const age = now - bucket.lastRefill;

      // Remove buckets that haven't been used in 2x the window
      if (age > staleThreshold && bucket.tokens === bucket.maxTokens) {
        this.buckets.delete(key);
      }
    }
  }
}

/**
 * Creates a rate limiter with the specified configuration
 *
 * @example
 * ```typescript
 * // Allow 10 requests per minute
 * const limiter = createRateLimiter({
 *   limit: 10,
 *   windowSeconds: 60
 * });
 *
 * const result = await limiter.checkLimit('user-123');
 * if (result.ok) {
 *   // Process request
 * } else {
 *   // Return 429 Too Many Requests
 *   console.log(`Retry after ${result.error.retryAfter} seconds`);
 * }
 * ```
 */
export function createRateLimiter(config: RateLimiterConfig): RateLimiter {
  return new RateLimiter(config);
}

/**
 * Multi-tier rate limiter with different limits per tier
 */
export class MultiTierRateLimiter {
  private readonly limiters: Map<string, RateLimiter>;

  constructor() {
    this.limiters = new Map();
  }

  /**
   * Adds a tier with specific rate limit
   */
  addTier(tier: string, config: RateLimiterConfig): void {
    this.limiters.set(tier, createRateLimiter(config));
  }

  /**
   * Checks rate limit for a specific tier
   */
  async checkLimit(
    tier: string,
    key: string
  ): Promise<Result<boolean, RateLimitError>> {
    const limiter = this.limiters.get(tier);
    if (!limiter) {
      // No limiter for this tier - allow by default
      return Ok(true);
    }

    return await limiter.checkLimit(key);
  }

  /**
   * Resets limits for a tier
   */
  reset(tier: string, key: string): void {
    const limiter = this.limiters.get(tier);
    if (limiter) {
      limiter.reset(key);
    }
  }

  /**
   * Destroys all limiters
   */
  destroy(): void {
    for (const limiter of this.limiters.values()) {
      limiter.destroy();
    }
    this.limiters.clear();
  }
}

/**
 * Creates a multi-tier rate limiter
 *
 * @example
 * ```typescript
 * const limiter = createMultiTierRateLimiter();
 *
 * // Free tier: 10 requests per hour
 * limiter.addTier('free', { limit: 10, windowSeconds: 3600 });
 *
 * // Premium tier: 1000 requests per hour
 * limiter.addTier('premium', { limit: 1000, windowSeconds: 3600 });
 *
 * // Check limit based on user tier
 * const result = await limiter.checkLimit(userTier, userId);
 * ```
 */
export function createMultiTierRateLimiter(): MultiTierRateLimiter {
  return new MultiTierRateLimiter();
}
