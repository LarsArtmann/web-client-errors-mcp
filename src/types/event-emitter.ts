/**
 * Type-Safe Event Emitter
 *
 * Provides strongly-typed event emission and subscription.
 * All event names and payloads are type-checked at compile time.
 *
 * Benefits:
 * - Complete type safety for event names and payloads
 * - Impossible to emit wrong event type
 * - Impossible to subscribe with wrong handler signature
 * - Auto-completion for event names and payload properties
 * - No runtime errors from typos in event names
 * - Clean unsubscribe mechanism
 *
 * @example
 * ```typescript
 * interface Events {
 *   'error:detected': { error: WebError; sessionId: SessionId };
 *   'session:created': { sessionId: SessionId };
 *   'performance:slow': { metric: string; value: number };
 * }
 *
 * const emitter = createEventEmitter<Events>();
 *
 * // Type-safe subscription
 * emitter.on('error:detected', ({ error, sessionId }) => {
 *   console.log(`Error ${error.id} in session ${sessionId}`);
 * });
 *
 * // Type-safe emission
 * emitter.emit('error:detected', { error, sessionId });
 * ```
 */

/**
 * Event handler function type
 */
export type EventHandler<T> = (payload: T) => void | Promise<void>;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Type-safe Event Emitter interface
 * TEvents: Record of event names to payload types
 */
export interface IEventEmitter<TEvents extends Record<string, unknown>> {
  /**
   * Subscribes to an event
   * Returns an unsubscribe function
   */
  on<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): Unsubscribe;

  /**
   * Subscribes to an event, but only fires once
   * Automatically unsubscribes after first emission
   */
  once<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): Unsubscribe;

  /**
   * Emits an event with payload
   * All subscribed handlers are called
   */
  emit<K extends keyof TEvents>(
    event: K,
    payload: TEvents[K]
  ): Promise<void>;

  /**
   * Removes a specific handler from an event
   */
  off<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): void;

  /**
   * Removes all handlers for a specific event
   * If no event specified, removes all handlers
   */
  removeAllListeners<K extends keyof TEvents>(event?: K): void;

  /**
   * Gets count of handlers for an event
   */
  listenerCount<K extends keyof TEvents>(event: K): number;

  /**
   * Lists all events that have listeners
   */
  eventNames(): Array<keyof TEvents>;
}

/**
 * Type-safe Event Emitter implementation
 */
export class EventEmitter<TEvents extends Record<string, unknown>> implements IEventEmitter<TEvents> {
  private readonly handlers: Map<keyof TEvents, Set<EventHandler<unknown>>>;
  private readonly onceHandlers: Set<EventHandler<unknown>>;

  constructor() {
    this.handlers = new Map();
    this.onceHandlers = new Set();
  }

  on<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): Unsubscribe {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const handlers = this.handlers.get(event)!;
    handlers.add(handler as EventHandler<unknown>);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  once<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): Unsubscribe {
    const wrappedHandler: EventHandler<TEvents[K]> = async (payload) => {
      // Remove handler after first call
      this.off(event, wrappedHandler);
      this.onceHandlers.delete(wrappedHandler as EventHandler<unknown>);

      // Call original handler
      await handler(payload);
    };

    this.onceHandlers.add(wrappedHandler as EventHandler<unknown>);
    return this.on(event, wrappedHandler);
  }

  async emit<K extends keyof TEvents>(
    event: K,
    payload: TEvents[K]
  ): Promise<void> {
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Call all handlers (supports both sync and async)
    const promises: Array<Promise<void>> = [];

    for (const handler of handlers) {
      try {
        const result = handler(payload);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (error) {
        // Log error but don't throw - one handler shouldn't break others
        console.error(`Error in event handler for ${String(event)}:`, error);
      }
    }

    // Wait for all async handlers to complete
    if (promises.length > 0) {
      await Promise.all(promises);
    }
  }

  off<K extends keyof TEvents>(
    event: K,
    handler: EventHandler<TEvents[K]>
  ): void {
    const handlers = this.handlers.get(event);
    if (handlers) {
      handlers.delete(handler as EventHandler<unknown>);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  removeAllListeners<K extends keyof TEvents>(event?: K): void {
    if (event === undefined) {
      // Remove all handlers for all events
      this.handlers.clear();
      this.onceHandlers.clear();
    } else {
      // Remove handlers for specific event
      this.handlers.delete(event);
    }
  }

  listenerCount<K extends keyof TEvents>(event: K): number {
    const handlers = this.handlers.get(event);
    return handlers ? handlers.size : 0;
  }

  eventNames(): Array<keyof TEvents> {
    return Array.from(this.handlers.keys());
  }
}

/**
 * Factory function to create a type-safe event emitter
 *
 * @example
 * ```typescript
 * interface AppEvents {
 *   'user:login': { userId: string; timestamp: number };
 *   'user:logout': { userId: string };
 *   'error:critical': { message: string; stack: string };
 * }
 *
 * const events = createEventEmitter<AppEvents>();
 *
 * events.on('user:login', ({ userId, timestamp }) => {
 *   console.log(`User ${userId} logged in at ${timestamp}`);
 * });
 *
 * events.emit('user:login', {
 *   userId: '123',
 *   timestamp: Date.now()
 * });
 * ```
 */
export function createEventEmitter<TEvents extends Record<string, unknown>>(): IEventEmitter<TEvents> {
  return new EventEmitter<TEvents>();
}

/**
 * Event middleware - allows intercepting and transforming events
 */
export type EventMiddleware<TEvents extends Record<string, unknown>> = <K extends keyof TEvents>(
  event: K,
  payload: TEvents[K],
  next: () => Promise<void>
) => Promise<void>;

/**
 * Event Emitter with middleware support
 */
export class EventEmitterWithMiddleware<TEvents extends Record<string, unknown>> extends EventEmitter<TEvents> {
  private readonly middlewares: Array<EventMiddleware<TEvents>>;

  constructor() {
    super();
    this.middlewares = [];
  }

  /**
   * Adds middleware to the event pipeline
   * Middleware is executed in order before handlers
   */
  use(middleware: EventMiddleware<TEvents>): void {
    this.middlewares.push(middleware);
  }

  /**
   * Emits event through middleware pipeline
   */
  override async emit<K extends keyof TEvents>(
    event: K,
    payload: TEvents[K]
  ): Promise<void> {
    // Execute middlewares in order
    let index = 0;

    const next = async (): Promise<void> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        await middleware(event, payload, next);
      } else {
        // All middlewares executed, call handlers
        await super.emit(event, payload);
      }
    };

    await next();
  }
}

/**
 * Creates an event emitter with middleware support
 *
 * @example
 * ```typescript
 * const events = createEventEmitterWithMiddleware<AppEvents>();
 *
 * // Add logging middleware
 * events.use(async (event, payload, next) => {
 *   console.log(`Event: ${String(event)}`, payload);
 *   await next();
 * });
 *
 * // Add validation middleware
 * events.use(async (event, payload, next) => {
 *   if (validate(payload)) {
 *     await next();
 *   } else {
 *     console.error('Invalid payload');
 *   }
 * });
 * ```
 */
export function createEventEmitterWithMiddleware<TEvents extends Record<string, unknown>>(): EventEmitterWithMiddleware<TEvents> {
  return new EventEmitterWithMiddleware<TEvents>();
}
