// Enhanced type definitions for better type safety

export interface MCPRequest {
  params: {
    arguments: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  [key: string]: unknown;
}

export interface MCPToolResult extends MCPResponse {}
export interface MCPResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
  [key: string]: unknown;
}

export interface LogRecord {
  [key: string]: unknown;
}

export interface LogSink {
  (record: LogRecord): void | Promise<void>;
}

export interface LogContext {
  [key: string]: unknown;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

// Browser and error detection types
export interface BrowserTiming {
  responseEnd: number;
  [key: string]: number;
}

export interface PerformanceEntry {
  name: string;
  startTime?: number;
  domContentLoadedEventEnd?: number;
  domContentLoadedEventStart?: number;
  loadEventEnd?: number;
  loadEventStart?: number;
}

export interface PerformanceMetrics {
  domContentLoaded: number;
  loadComplete: number;
  firstContentfulPaint?: number;
}

export interface SensitiveDataObject {
  [key: string]: unknown;
}

// Enhanced configuration types
export interface EnhancedServerConfig {
  browser: {
    headless: boolean;
    viewport: { width: number; height: number };
    userAgent: string;
    args: string[];
  };
  thresholds: {
    slowResponse: number;
    sessionTimeout: number;
    maxErrors: number;
  };
  logging: {
    level: LogLevel;
    structured: boolean;
    redactSensitiveData: boolean;
  };
  features: {
    domSnapshots: boolean;
    performanceMetrics: boolean;
    errorDeduplication: boolean;
    sentryIntegration: boolean;
    realTimeStreaming?: boolean;
    crossSessionAnalysis?: boolean;
  };
  sentry?: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
  };
}