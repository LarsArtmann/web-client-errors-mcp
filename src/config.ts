// Note: Zod imports temporarily disabled for testing
// Configuration will be validated at API layer when needed

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