// 🚨 IMMEDIATE ARCHITECTURAL FIXES NEEDED

// 1. Branded types for IMPOSSIBLE STATE PREVENTION
export type ISO8601String = string & { readonly __brand: unique symbol };
export type SessionId = string & { readonly __brand: unique symbol };
export type ErrorId = string & { readonly __brand: unique symbol };
export type NonEmptyString = string & { readonly __brand: unique symbol };

// Type guards to ensure impossibility
export const isISO8601 = (s: string): s is ISO8601String => {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(s);
};

export const createErrorId = (input: string): ErrorId => {
  if (!input || input.trim().length === 0) {
    throw new Error("Error ID cannot be empty");
  }
  return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as ErrorId;
};

// 2. Discriminated unions for TYPE SAFETY
export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorType =
  | "javascript"
  | "network"
  | "resource"
  | "console"
  | "performance"
  | "security";

export interface BaseWebError {
  readonly id: ErrorId;
  readonly message: NonEmptyString;
  readonly timestamp: ISO8601String;
  readonly severity: ErrorSeverity;
  readonly type: ErrorType;
  readonly frequency: number; // ALWAYS present, default 0
}

export interface JavaScriptError extends BaseWebError {
  readonly type: "javascript";
  readonly stack: NonEmptyString;
  readonly line: number;
  readonly column: number;
  readonly url: string;
}

export interface NetworkError extends BaseWebError {
  readonly type: "network";
  readonly url: string;
  readonly statusCode?: number;
  readonly responseTime: number;
}

export type WebError =
  | JavaScriptError
  | NetworkError
  | ResourceError
  | ConsoleError
  | PerformanceError
  | SecurityError;

// 3. Explicit state for optional features
export interface DOMSnapshot {
  readonly exists: boolean;
  readonly data?: string;
  readonly size: number;
  readonly timestamp: ISO8601String;
}

export interface ErrorContext {
  readonly userAgent: NonEmptyString;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly url: string;
  readonly domSnapshot: DOMSnapshot; // Explicit state!
  readonly networkConditions: NetworkConditions; // Explicit state!
}

export interface NetworkConditions {
  readonly isOnline: boolean;
  readonly connectionType?: string;
  readonly effectiveType?: string;
  readonly rtt?: number;
  readonly downlink?: number;
}

// 4. Immutable session management
export interface ErrorSession {
  readonly id: SessionId;
  readonly url: string;
  readonly startTime: ISO8601String;
  readonly endTime?: ISO8601String;
  readonly duration?: number; // Calculated, not stored
  readonly errors: readonly WebError[]; // Immutable
  readonly screenshots: readonly string[];
  readonly metadata: Readonly<SessionMetadata>;
}

// 5. Proper event sourcing pattern
export interface ErrorEvent {
  readonly type:
    | "ERROR_DETECTED"
    | "ERROR_CLASSIFIED"
    | "SESSION_CREATED"
    | "SESSION_COMPLETED";
  readonly sessionId: SessionId;
  readonly timestamp: ISO8601String;
  readonly data: unknown;
}
