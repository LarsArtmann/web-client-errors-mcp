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

export interface MCPResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  _meta?: {
    [key: string]: unknown;
  };
}

// Logging Types (compatible with LogTape)
export interface LogContext {
  [key: string]: unknown;
}

export type LogLevel = "trace" | "debug" | "info" | "warning" | "error" | "fatal";

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warning(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void; // Alias for warning
  error(message: string, context?: LogContext): void;
  fatal(message: string, context?: LogContext): void;
}

// Type guards and validators
export function isCallToolRequest(request: unknown): request is CallToolRequest {
  return (
    typeof request === "object" &&
    request !== null &&
    "method" in request &&
    (request as CallToolRequest).method === "tools/call" &&
    "params" in request &&
    typeof (request as CallToolRequest).params === "object"
  );
}

export function hasValidArguments(request: CallToolRequest): request is CallToolRequest & {
  params: CallToolRequest["params"] & { arguments: Record<string, unknown> };
} {
  return typeof request.params.arguments === "object" && request.params.arguments !== null;
}

// Utility types for better type safety
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type WithRequired<T, K extends keyof T> = T & Required<Pick<T, K>>;
