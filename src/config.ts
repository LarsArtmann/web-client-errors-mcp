// Note: Zod validation is handled at the API layer in mcp-server.ts
// Configuration uses TypeScript types for compile-time safety

import type { ServerConfig } from './types.js';

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
  // Basic validation without Zod to avoid import conflicts
  if (!config || typeof config !== 'object') {
    throw new Error('Configuration must be an object');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cfg = config as any; // Validated below with runtime checks

  if (!cfg.browser || typeof cfg.browser.headless !== 'boolean') {
    throw new Error('Invalid browser configuration');
  }
  if (!cfg.thresholds || typeof cfg.thresholds.sessionTimeout !== 'number') {
    throw new Error('Invalid thresholds configuration');
  }
  if (!cfg.features || typeof cfg.features.domSnapshots !== 'boolean') {
    throw new Error('Invalid features configuration');
  }

  return config as ServerConfig;
}