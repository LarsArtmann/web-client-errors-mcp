// Note: Zod imports temporarily disabled for testing
// Configuration will be validated at API layer when needed
import { z } from 'zod';

// Type definition for ServerConfig
export type ServerConfig = {
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
    level: 'trace' | 'debug' | 'info' | 'warning' | 'error' | 'fatal';
    structured: boolean;
    redactSensitiveData: boolean;
  };
  features: {
    domSnapshots: boolean;
    performanceMetrics: boolean;
    errorDeduplication: boolean;
    sentryIntegration: boolean;
  };
  sentry?: {
    dsn: string;
    environment: string;
    tracesSampleRate: number;
  };
};

export const ServerConfigSchema = z.object({
  browser: z.object({
    headless: z.boolean(),
    viewport: z.object({ width: z.number(), height: z.number() }),
    userAgent: z.string(),
    args: z.array(z.string()),
  }),
  thresholds: z.object({
    slowResponse: z.number(),
    sessionTimeout: z.number(),
    maxErrors: z.number(),
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warning', 'error', 'fatal']),
    structured: z.boolean(),
    redactSensitiveData: z.boolean(),
  }),
  features: z.object({
    domSnapshots: z.boolean(),
    performanceMetrics: z.boolean(),
    errorDeduplication: z.boolean(),
    sentryIntegration: z.boolean(),
  }),
  sentry: z.object({
    dsn: z.string(),
    environment: z.string(),
    tracesSampleRate: z.number(),
  }).optional(),
});

export const DEFAULT_CONFIG: ServerConfig = {
  browser: {
    headless: true,
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Web Client Errors MCP)',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  },
  thresholds: {
    slowResponse: 10000,
    sessionTimeout: 300000,
    maxErrors: 1000
  },
  logging: {
    level: 'info',
    structured: true,
    redactSensitiveData: true
  },
  features: {
    domSnapshots: true,
    performanceMetrics: true,
    errorDeduplication: true,
    sentryIntegration: false
  }
};

let globalConfig: ServerConfig = DEFAULT_CONFIG;

export function setConfig(config: Partial<ServerConfig>): void {
  globalConfig = { ...globalConfig, ...config };
}

export function getConfig(): ServerConfig {
  return globalConfig;
}

export function validateConfig(config: unknown): ServerConfig {
  return ServerConfigSchema.parse(config);
}