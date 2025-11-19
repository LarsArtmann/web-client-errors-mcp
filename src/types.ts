// Enhanced type definitions with proper MCP SDK integration

// MCP Types (based on actual SDK types)
export interface CallToolRequest {
  method: "tools/call";
  params: {
    name: string;
    arguments?: Record<string, unknown>;
    _meta?: {
      progressToken?: string | number;
      [key: string]: unknown;
    };
  };
}

export interface MCPRequest {
  method: string;
  params: {
    [key: string]: unknown;
    arguments?: Record<string, unknown>;
    _meta?: {
      progressToken?: string | number;
      [key: string]: unknown;
    };
  };
}

export interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  _meta?: {
    [key: string]: unknown;
  };
}

export interface MCPResourceResult {
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
  _meta?: {
    [key: string]: unknown;
  };
}

export type MCPToolResult = MCPResponse;

// Logging Types (compatible with LogTape)
export interface LogContext {
  [key: string]: unknown;
}

export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warning"
  | "error"
  | "fatal";

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warning(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void; // Alias for warning
  error(message: string, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
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

// Error detection types
export interface ErrorContext {
  userAgent: string;
  viewport: { width: number; height: number };
  url: string;
  domSnapshot?: string;
  networkConditions?: {
    online: boolean;
    connectionType?: string;
    effectiveType?: string;
  };
}

// Zod schema types for validation
export interface ToolHandler {
  (request: CallToolRequest): Promise<MCPResponse>;
}

export interface ErrorHandler {
  (error: Error | unknown, context?: LogContext): void;
}

// Enhanced configuration types
export interface ServerConfig {
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

// Type guards and validators
export function isCallToolRequest(
  request: unknown,
): request is CallToolRequest {
  return (
    typeof request === "object" &&
    request !== null &&
    "method" in request &&
    (request as CallToolRequest).method === "tools/call" &&
    "params" in request &&
    typeof (request as CallToolRequest).params === "object"
  );
}

export function hasValidArguments(
  request: CallToolRequest,
): request is CallToolRequest & {
  params: CallToolRequest["params"] & { arguments: Record<string, unknown> };
} {
  return (
    typeof request.params.arguments === "object" &&
    request.params.arguments !== null
  );
}

// Utility types for better type safety
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;
