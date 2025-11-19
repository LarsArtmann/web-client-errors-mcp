import {
  getLogger,
  configure,
  type LogRecord as LogTapeRecord,
} from "@logtape/logtape";
import { getConfig } from "./config.js";
import type { LogContext, Logger } from "./types.js";

// Configure LogTape for structured logging
export function initializeLogging() {
  const config = getConfig();

  if (!config.logging.structured) {
    // Fallback to console logging
    return;
  }

  configure({
    sinks: {
      console: (record: LogTapeRecord) => {
        const timestamp = new Date().toISOString();
        const level = String(record.level).toUpperCase();
        const category = Array.isArray(record.category)
          ? record.category.join(".")
          : String(record.category);

        // Handle LogTape message format (template or array)
        const messageText = Array.isArray(record.message)
          ? record.message.join("")
          : String(record.message);

        let properties: Record<string, unknown> = record.properties || {};
        if (config.logging.redactSensitiveData) {
          properties = redactSensitiveData(properties) || {};
        }

        const message = `[${timestamp}] ${level} ${category}: ${messageText}`;

        if (Object.keys(properties).length > 0) {
          console.log(`${message} ${JSON.stringify(properties)}`);
        } else {
          console.log(message);
        }
      },
    },
    loggers: [
      {
        category: "web-client-errors-mcp",
        sinks: ["console"],
        lowestLevel: config.logging.level,
      },
    ],
  });
}

export function getAppLogger(category: string = "main"): Logger {
  const config = getConfig();

  if (!config.logging.structured) {
    // Simple console fallback with redaction
    const logMethod =
      (level: string) => (message: string, context?: LogContext) => {
        const finalContext =
          config.logging.redactSensitiveData && context
            ? redactSensitiveData(context)
            : context;
        const logMessage = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`;

        if (finalContext && Object.keys(finalContext).length > 0) {
          console.log(`${logMessage} ${JSON.stringify(finalContext)}`);
        } else {
          console.log(logMessage);
        }
      };

    const logger: Logger = {
      debug: logMethod("debug"),
      info: logMethod("info"),
      warning: logMethod("warning"),
      warn: logMethod("warning"),
      error: logMethod("error"),
      fatal: logMethod("fatal"),
    };

    return logger;
  }

  return getLogger(category);
}

// Redact sensitive data from logs
function redactSensitiveData(
  data: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!data || typeof data !== "object") return data;

  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "key",
    "auth",
    "authorization",
    "cookie",
    "session",
    "csrf",
  ];

  function redactValue(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map(redactValue);
    }

    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some((field) => lowerKey.includes(field))) {
          result[key] = "[REDACTED]";
        } else if (typeof value === "object" && value !== null) {
          result[key] = redactValue(value as Record<string, unknown>);
        } else {
          result[key] = value;
        }
      }
      return result;
    }

    return obj;
  }

  return data ? (redactValue(data) as Record<string, unknown>) : data;
}

export default getAppLogger;
