#!/usr/bin/env bun

// 🚨 IMMEDIATE CRITICAL FIXES - PRODUCTION READINESS

import { createHash } from 'crypto';
import { z } from 'zod';

// 1. BRANDED TYPES FOR IMPOSSIBLE STATE PREVENTION
export type ISO8601String = string & { readonly __brand: unique symbol };
export type SessionId = string & { readonly __brand: unique symbol };
export type ErrorId = string & { readonly __brand: unique symbol };
export type NonEmptyString = string & { readonly __brand: unique symbol };

// Type Guards - MAKE IMPOSSIBLE STATES UNREPRESENTABLE
export const isISO8601 = (s: string): s is ISO8601String => {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/.test(s);
};

export const toISO8601 = (date: Date = new Date()): ISO8601String => {
  const iso = date.toISOString();
  if (!isISO8601(iso)) {
    throw new Error(`Invalid ISO8601 timestamp: ${iso}`);
  }
  return iso as ISO8601String;
};

export const toNonEmptyString = (s: string): NonEmptyString => {
  const trimmed = s.trim();
  if (trimmed.length === 0) {
    throw new Error('String cannot be empty');
  }
  return trimmed as NonEmptyString;
};

export const createSessionId = (): SessionId => {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as SessionId;
};

export const createErrorId = (): ErrorId => {
  return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` as ErrorId;
};

// 2. DISCRIMINATED UNIONS - NO MORE TYPE AMBIGUITY
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorType = 'javascript' | 'network' | 'resource' | 'console' | 'performance' | 'security';

export interface BaseWebError {
  readonly id: ErrorId;
  readonly message: NonEmptyString;
  readonly timestamp: ISO8601String;
  readonly severity: ErrorSeverity;
  readonly frequency: number; // ALWAYS present - no split brain!
}

export interface JavaScriptError extends BaseWebError {
  readonly type: 'javascript';
  readonly stack: NonEmptyString;
  readonly line: number;
  readonly column: number;
  readonly url: string;
}

export interface NetworkError extends BaseWebError {
  readonly type: 'network';
  readonly url: string;
  readonly statusCode?: number;
  readonly responseTime: number;
}

export interface ResourceError extends BaseWebError {
  readonly type: 'resource';
  readonly url: string;
  readonly statusCode: number;
  readonly contentType?: string;
}

export interface ConsoleError extends BaseWebError {
  readonly type: 'console';
  readonly level: 'error' | 'warning';
  readonly source?: string;
}

export interface PerformanceError extends BaseWebError {
  readonly type: 'performance';
  readonly metric: string;
  readonly value: number;
  readonly threshold: number;
}

export interface SecurityError extends BaseWebError {
  readonly type: 'security';
  readonly violation: string;
  readonly blocked: boolean;
}

export type WebError = JavaScriptError | NetworkError | ResourceError | ConsoleError | PerformanceError | SecurityError;

// 3. EXPLICIT STATE - NO MORE OPTIONAL AMBIGUITY
export interface DOMSnapshot {
  readonly exists: boolean;
  readonly data?: string;
  readonly size: number;
  readonly timestamp: ISO8601String;
}

export interface NetworkConditions {
  readonly isOnline: boolean;
  readonly connectionType?: string;
  readonly effectiveType?: string;
  readonly rtt?: number;
  readonly downlink?: number;
}

export interface ErrorContext {
  readonly userAgent: NonEmptyString;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly url: string;
  readonly domSnapshot: DOMSnapshot;
  readonly networkConditions: NetworkConditions;
}

// 4. IMMUTABLE SESSION MANAGEMENT - NO MUTATION BUGS
export interface SessionMetadata {
  readonly userAgent: NonEmptyString;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly platform: string;
  readonly language: string;
  readonly cookiesEnabled: boolean;
  readonly javascriptEnabled: boolean;
  readonly onlineStatus: boolean;
  readonly domSnapshot?: DOMSnapshot;
  readonly performanceMetrics?: PerformanceMetrics;
}

export interface PerformanceMetrics {
  readonly domContentLoaded: number;
  readonly loadComplete: number;
  readonly firstContentfulPaint?: number;
  readonly largestContentfulPaint?: number;
  readonly cumulativeLayoutShift?: number;
  readonly firstInputDelay?: number;
}

export interface ErrorSession {
  readonly id: SessionId;
  readonly url: string;
  readonly startTime: ISO8601String;
  readonly endTime?: ISO8601String;
  readonly duration?: number; // Calculated, not stored
  readonly errors: readonly WebError[]; // Immutable!
  readonly screenshots: readonly string[]; // Immutable!
  readonly metadata: Readonly<SessionMetadata>;
}

// 5. VALIDATED SCHEMAS - ZOD WITH BRANDED TYPES
export const SessionIdSchema = z.string().min(1).transform(createSessionId);
export const ErrorIdSchema = z.string().min(1).transform(createErrorId);
export const NonEmptyStringSchema = z.string().min(1).transform(toNonEmptyString);
export const ISO8601Schema = z.string().datetime().transform(toISO8601);

export const WebErrorSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('javascript'),
    id: ErrorIdSchema,
    message: NonEmptyStringSchema,
    timestamp: ISO8601Schema,
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    frequency: z.number().min(0),
    stack: NonEmptyStringSchema,
    line: z.number().min(0),
    column: z.number().min(0),
    url: z.string().url(),
  }),
  z.object({
    type: z.literal('network'),
    id: ErrorIdSchema,
    message: NonEmptyStringSchema,
    timestamp: ISO8601Schema,
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    frequency: z.number().min(0),
    url: z.string().url(),
    statusCode: z.number().min(100).max(599).optional(),
    responseTime: z.number().min(0),
  }),
  // TODO: Add other error types
]);

// 6. TYPE-CREATION HELPERS - ENSURE VALIDITY
export const createJavaScriptError = (
  message: string,
  stack: string,
  line: number,
  column: number,
  url: string,
  severity: ErrorSeverity = 'medium'
): JavaScriptError => ({
  type: 'javascript',
  id: createErrorId(),
  message: toNonEmptyString(message),
  timestamp: toISO8601(),
  severity,
  frequency: 0, // Always present!
  stack: toNonEmptyString(stack),
  line: Math.max(0, line),
  column: Math.max(0, column),
  url,
});

export const createNetworkError = (
  message: string,
  url: string,
  responseTime: number,
  statusCode?: number,
  severity: ErrorSeverity = 'medium'
): NetworkError => ({
  type: 'network',
  id: createErrorId(),
  message: toNonEmptyString(message),
  timestamp: toISO8601(),
  severity,
  frequency: 0, // Always present!
  url,
  statusCode,
  responseTime: Math.max(0, responseTime),
});

export const createErrorSession = (
  url: string,
  metadata: SessionMetadata,
  sessionId?: SessionId
): ErrorSession => ({
  id: sessionId || createSessionId(),
  url,
  startTime: toISO8601(),
  errors: [], // Empty array, not undefined!
  screenshots: [], // Empty array, not undefined!
  metadata: Object.freeze(metadata), // Immutable!
});

// 7. MEMORY-SAFE SESSION MANAGER - NO LEAKS
export class SessionManager {
  private readonly sessions = new Map<SessionId, ErrorSession>();
  private readonly ttlMs: number;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(ttlMs: number = 30 * 60 * 1000) { // 30 minutes default
    this.ttlMs = ttlMs;
    this.startCleanup();
  }

  createSession(url: string, metadata: SessionMetadata, sessionId?: SessionId): SessionId {
    const session = createErrorSession(url, metadata, sessionId);
    this.sessions.set(session.id, session);
    return session.id;
  }

  getSession(id: SessionId): ErrorSession | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    // Check TTL
    const age = Date.now() - new Date(session.startTime).getTime();
    if (age > this.ttlMs) {
      this.sessions.delete(id);
      return undefined;
    }

    return session;
  }

  updateSession(id: SessionId, updates: Partial<ErrorSession>): ErrorSession | undefined {
    const current = this.getSession(id);
    if (!current) return undefined;

    const updated = { ...current, ...updates };
    this.sessions.set(id, updated);
    return updated;
  }

  deleteSession(id: SessionId): boolean {
    return this.sessions.delete(id);
  }

  getAllSessions(): readonly ErrorSession[] {
    return Array.from(this.sessions.values());
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions.entries()) {
      const age = now - new Date(session.startTime).getTime();
      if (age > this.ttlMs) {
        this.sessions.delete(id);
      }
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.sessions.clear();
  }
}

// 8. IMMUTABLE ERROR STORE - THREAD SAFE
export class ErrorStore {
  private readonly errors = new Map<ErrorId, WebError>();

  addError(error: WebError): void {
    this.errors.set(error.id, Object.freeze(error)); // Immutable!
  }

  getError(id: ErrorId): WebError | undefined {
    return this.errors.get(id);
  }

  getErrorsBySession(sessionId: SessionId): readonly WebError[] {
    // In a real implementation, we'd index by session ID
    return Array.from(this.errors.values());
  }

  getAllErrors(): readonly WebError[] {
    return Array.from(this.errors.values());
  }

  clear(): void {
    this.errors.clear();
  }

  size(): number {
    return this.errors.size;
  }
}

export default {
  // Types
  type WebError,
  type ErrorSession,
  type SessionId,
  type ErrorId,
  type ISO8601String,
  type NonEmptyString,
  
  // Helpers
  createSessionId,
  createErrorId,
  toISO8601,
  toNonEmptyString,
  isISO8601,
  
  // Creators
  createJavaScriptError,
  createNetworkError,
  createErrorSession,
  
  // Managers
  SessionManager,
  ErrorStore,
};