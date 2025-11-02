import { z } from 'zod';

const ServerConfigSchema = z.object({
  browser: z.object({
    headless: z.boolean(),
    viewport: z.object({
      width: z.number().min(100).max(10000),
      height: z.number().min(100).max(10000)
    }),
    userAgent: z.string().min(1),
    args: z.array(z.string())
  }),
  thresholds: z.object({
    slowResponse: z.number().min(100),
    sessionTimeout: z.number().min(1000),
    maxErrors: z.number().min(1)
  }),
  logging: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warning', 'error', 'fatal']),
    structured: z.boolean(),
    redactSensitiveData: z.boolean()
  }),
  features: z.object({
    domSnapshots: z.boolean(),
    performanceMetrics: z.boolean(),
    errorDeduplication: z.boolean(),
    sentryIntegration: z.boolean()
  }),
  sentry: z.object({
    dsn: z.string().url(),
    environment: z.string(),
    tracesSampleRate: z.number().min(0).max(1)
  }).optional()
});

export type ServerConfig = z.infer<typeof ServerConfigSchema>;

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
    level: 'info' as const,
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