#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { z } from 'zod';

// Error detection interface based on research of existing patterns
interface WebError {
  message: string;
  type: 'javascript' | 'console' | 'network' | 'resource';
  stack?: string;
  url?: string;
  line?: number;
  column?: number;
  timestamp: string;
  severity: 'error' | 'warning' | 'info';
}

interface ErrorSession {
  id: string;
  url: string;
  startTime: string;
  errors: WebError[];
  screenshots?: string[];
  browserContext?: BrowserContext;
}

// Global error session management
const sessions = new Map<string, ErrorSession>();
let browser: Browser | null = null;

// Validation schemas
const DetectErrorsSchema = z.object({
  url: z.string().url("Invalid URL format"),
  waitTime: z.number().min(1000).max(60000).default(5000),
  captureScreenshot: z.boolean().default(true),
  includeNetworkErrors: z.boolean().default(true),
  includeConsoleWarnings: z.boolean().default(true),
  interactWithPage: z.boolean().default(false),
  sessionId: z.string().optional()
});

const AnalyzeErrorsSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required"),
  includeSuggestions: z.boolean().optional().default(true),
  severity: z.enum(['error', 'warning', 'info', 'all']).optional().default('all')
});

const GetErrorDetailsSchema = z.object({
  errorId: z.string().min(1, "Error ID is required"),
  includeStackTrace: z.boolean().optional().default(true),
  includeContext: z.boolean().optional().default(true)
});

// Create MCP server
const server = new Server(
  {
    name: 'web-client-errors-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// Helper functions based on KeyCountdown patterns
function createErrorSession(url: string, sessionId?: string): ErrorSession {
  const id = sessionId || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    url,
    startTime: new Date().toISOString(),
    errors: [],
    screenshots: []
  };
}

async function initializeBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
  }
  return browser;
}

async function detectPageErrors(page: Page, session: ErrorSession, options: z.infer<typeof DetectErrorsSchema>): Promise<void> {
  const errors: WebError[] = [];

  // JavaScript error detection (KeyCountdown pattern)
  page.on('pageerror', (error) => {
    const webError: WebError = {
      message: error.message,
      type: 'javascript',
      stack: error.stack,
      timestamp: new Date().toISOString(),
      severity: 'error'
    };
    errors.push(webError);
    session.errors.push(webError);
  });

  // Console API monitoring
  page.on('console', (msg) => {
    if (msg.type() === 'error' || (options.includeConsoleWarnings && msg.type() === 'warning')) {
      const webError: WebError = {
        message: msg.text(),
        type: 'console',
        timestamp: new Date().toISOString(),
        severity: msg.type() === 'error' ? 'error' : 'warning'
      };
      errors.push(webError);
      session.errors.push(webError);
    }
  });

  // Network error detection
  if (options.includeNetworkErrors) {
    page.on('requestfailed', (request) => {
      const webError: WebError = {
        message: `Failed to load: ${request.url()} - ${request.failure()?.errorText}`,
        type: 'network',
        url: request.url(),
        timestamp: new Date().toISOString(),
        severity: 'error'
      };
      errors.push(webError);
      session.errors.push(webError);
    });
  }

  // Resource loading errors
  page.on('response', (response) => {
    if (response.status() >= 400) {
      const webError: WebError = {
        message: `HTTP ${response.status()}: ${response.url()}`,
        type: 'resource',
        url: response.url(),
        timestamp: new Date().toISOString(),
        severity: 'error'
      };
      errors.push(webError);
      session.errors.push(webError);
    }
  });
}

async function takePageScreenshot(page: Page): Promise<string> {
  try {
    const screenshot = await page.screenshot({ 
      type: 'png',
      fullPage: true,
      quality: 80 
    });
    return screenshot.toString('base64');
  } catch (error) {
    console.error('Failed to take screenshot:', error);
    return '';
  }
}

// Tool: detect_errors
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'detect_errors') {
    return { 
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Unknown tool' }) 
      }] 
    };
  }

  try {
    const options = DetectErrorsSchema.parse(request.params.arguments);
    const browser = await initializeBrowser();
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    
    const page = await context.newPage();
    const session = createErrorSession(options.url, options.sessionId || undefined);
    sessions.set(session.id, session);
    session.browserContext = context;

    // Set up error detection before navigation
    await detectPageErrors(page, session, options);

    // Navigate to page
    await page.goto(options.url, { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });

    // Optional page interaction to trigger errors
    if (options.interactWithPage) {
      await page.waitForTimeout(1000);
      await page.click('body');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(2000);
    }

    // Wait for errors to occur
    await page.waitForTimeout(options.waitTime);

    // Take screenshot if requested
    if (options.captureScreenshot) {
      const screenshot = await takePageScreenshot(page);
      if (screenshot) {
        session.screenshots?.push(screenshot);
      }
    }

    // Close page and context
    await page.close();
    await context.close();

    const errorSummary = {
      sessionId: session.id,
      url: session.url,
      timestamp: session.startTime,
      totalErrors: session.errors.length,
      errorsByType: {
        javascript: session.errors.filter(e => e.type === 'javascript').length,
        console: session.errors.filter(e => e.type === 'console').length,
        network: session.errors.filter(e => e.type === 'network').length,
        resource: session.errors.filter(e => e.type === 'resource').length
      },
      errorsBySeverity: {
        error: session.errors.filter(e => e.severity === 'error').length,
        warning: session.errors.filter(e => e.severity === 'warning').length,
        info: session.errors.filter(e => e.severity === 'info').length
      },
      hasScreenshot: options.captureScreenshot && session.screenshots && session.screenshots.length > 0,
      errors: session.errors
    };

    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(errorSummary, null, 2) 
      }]
    };

  } catch (error) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: 'Detection failed', 
          details: error instanceof Error ? error.message : String(error)
        }) 
      }]
    };
  }
});

// Tool: analyze_error_session
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'analyze_error_session') {
    return { 
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Unknown tool' }) 
      }] 
    };
  }

  try {
    const options = AnalyzeErrorsSchema.parse(request.params.arguments);
    const session = sessions.get(options.sessionId);

    if (!session) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ error: 'Session not found' }) 
        }]
      };
    }

    let filteredErrors = session.errors;
    if (options.severity !== 'all') {
      filteredErrors = session.errors.filter(e => e.severity === options.severity);
    }

    const analysis = {
      sessionId: session.id,
      url: session.url,
      timestamp: session.startTime,
      totalErrors: filteredErrors.length,
      errorPatterns: analyzeErrorPatterns(filteredErrors),
      commonErrors: getMostCommonErrors(filteredErrors),
      suggestions: options.includeSuggestions ? generateErrorSuggestions(filteredErrors) : [],
      timeline: generateErrorTimeline(filteredErrors),
      severityBreakdown: {
        error: filteredErrors.filter(e => e.severity === 'error').length,
        warning: filteredErrors.filter(e => e.severity === 'warning').length,
        info: filteredErrors.filter(e => e.severity === 'info').length
      }
    };

    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(analysis, null, 2) 
      }]
    };

  } catch (error) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: 'Analysis failed', 
          details: error instanceof Error ? error.message : String(error)
        }) 
      }]
    };
  }
});

// Tool: get_error_details
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'get_error_details') {
    return { 
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Unknown tool' }) 
      }] 
    };
  }

  try {
    const options = GetErrorDetailsSchema.parse(request.params.arguments);
    
    // Find error across all sessions
    let targetError: WebError | null = null;
    for (const session of sessions.values()) {
      const error = session.errors.find(e => e.message.includes(options.errorId) || e.stack?.includes(options.errorId));
      if (error) {
        targetError = error;
        break;
      }
    }

    if (!targetError) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ error: 'Error not found' }) 
        }]
      };
    }

    const details = {
      ...targetError,
      suggestions: generateErrorSuggestions([targetError]),
      relatedPatterns: findRelatedErrorPatterns(targetError),
      potentialCauses: analyzePotentialCauses(targetError)
    };

    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(details, null, 2) 
      }]
    };

  } catch (error) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: 'Details retrieval failed', 
          details: error instanceof Error ? error.message : String(error)
        }) 
      }]
    };
  }
});

// Resource handlers for accessing error data
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'errors://recent',
        name: 'Recent Errors',
        description: 'Most recent errors from all monitoring sessions',
        mimeType: 'application/json'
      },
      {
        uri: 'errors://stats',
        name: 'Error Statistics', 
        description: 'Aggregated error statistics and analytics',
        mimeType: 'application/json'
      }
    ]
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'errors://recent') {
    const allErrors = Array.from(sessions.values())
      .flatMap(session => session.errors)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100); // Last 100 errors

    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          totalErrors: allErrors.length,
          errors: allErrors,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  if (uri === 'errors://stats') {
    const stats = generateAggregateStats();
    return {
      contents: [{
        uri,
        mimeType: 'application/json', 
        text: JSON.stringify(stats, null, 2)
      }]
    };
  }

  return {
    contents: [{
      uri,
      mimeType: 'application/json',
      text: JSON.stringify({ error: 'Resource not found' })
    }]
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'detect_errors',
        description: 'Detect client-side errors on a website using Playwright browser automation',
        inputSchema: {
          type: 'object',
          properties: {
            url: { 
              type: 'string', 
              description: 'The URL to monitor for errors' 
            },
            waitTime: { 
              type: 'number', 
              description: 'Time to wait for errors in milliseconds (default: 5000)',
              default: 5000
            },
            captureScreenshot: { 
              type: 'boolean', 
              description: 'Capture screenshot of the page (default: true)',
              default: true
            },
            includeNetworkErrors: { 
              type: 'boolean', 
              description: 'Include network errors in detection (default: true)',
              default: true
            },
            includeConsoleWarnings: { 
              type: 'boolean', 
              description: 'Include console warnings in results (default: true)',
              default: true
            },
            interactWithPage: { 
              type: 'boolean', 
              description: 'Interact with page to trigger potential errors (default: false)',
              default: false
            },
            sessionId: { 
              type: 'string', 
              description: 'Optional session ID for grouping errors',
              default: ''
            }
          },
          required: ['url']
        }
      },
      {
        name: 'analyze_error_session',
        description: 'Analyze collected errors and provide insights',
        inputSchema: {
          type: 'object',
          properties: {
            sessionId: { 
              type: 'string', 
              description: 'The session ID to analyze' 
            },
            includeSuggestions: { 
              type: 'boolean', 
              description: 'Include AI-powered fix suggestions (default: true)',
              default: true
            },
            severity: { 
              type: 'string', 
              description: 'Filter by severity level',
              enum: ['error', 'warning', 'info', 'all'],
              default: 'all'
            }
          },
          required: ['sessionId']
        }
      },
      {
        name: 'get_error_details',
        description: 'Get detailed information about a specific error',
        inputSchema: {
          type: 'object',
          properties: {
            errorId: { 
              type: 'string', 
              description: 'The error ID or message fragment to search for' 
            },
            includeStackTrace: { 
              type: 'boolean', 
              description: 'Include full stack trace (default: true)',
              default: true
            },
            includeContext: { 
              type: 'boolean', 
              description: 'Include error context and analysis (default: true)',
              default: true
            }
          },
          required: ['errorId']
        }
      }
    ]
  };
});

// Helper functions for error analysis
function analyzeErrorPatterns(errors: WebError[]): string[] {
  const patterns = new Map<string, number>();
  
  errors.forEach(error => {
    const pattern = extractErrorPattern(error.message);
    patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
  });

  return Array.from(patterns.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([pattern]) => pattern);
}

function extractErrorPattern(message: string): string {
  // Extract common error patterns
  if (message.includes('TypeError')) return 'TypeError';
  if (message.includes('ReferenceError')) return 'ReferenceError';
  if (message.includes('NetworkError')) return 'NetworkError';
  if (message.includes('SyntaxError')) return 'SyntaxError';
  if (message.includes('404')) return '404 Not Found';
  if (message.includes('500')) return '500 Server Error';
  if (message.includes('CORS')) return 'CORS Error';
  if (message.includes('permission')) return 'Permission Error';
  if (message.includes('undefined')) return 'Undefined Property';
  return 'Other';
}

function getMostCommonErrors(errors: WebError[]): Array<{message: string, count: number, type: string}> {
  const errorCounts = new Map<string, {count: number, type: string}>();
  
  errors.forEach(error => {
    const key = error.message.substring(0, 100); // First 100 chars
    const existing = errorCounts.get(key) || { count: 0, type: error.type };
    existing.count++;
    errorCounts.set(key, existing);
  });

  return Array.from(errorCounts.entries())
    .map(([message, {count, type}]) => ({ message, count, type }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function generateErrorSuggestions(errors: WebError[]): string[] {
  const suggestions: string[] = [];
  
  errors.forEach(error => {
    if (error.message.includes('undefined')) {
      suggestions.push('Check if variable is properly initialized before use');
    }
    if (error.message.includes('TypeError')) {
      suggestions.push('Verify data types of variables and function parameters');
    }
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      suggestions.push('Check network connectivity and API endpoint availability');
    }
    if (error.message.includes('CORS')) {
      suggestions.push('Configure CORS headers on the server or use same-origin requests');
    }
    if (error.message.includes('404')) {
      suggestions.push('Verify the requested resource exists and URL is correct');
    }
  });

  return [...new Set(suggestions)]; // Remove duplicates
}

function generateErrorTimeline(errors: WebError[]): Array<{time: string, count: number, severity: string}> {
  const timeline = new Map<string, number>();
  
  errors.forEach(error => {
    const minute = new Date(error.timestamp).toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
    timeline.set(minute, (timeline.get(minute) || 0) + 1);
  });

  return Array.from(timeline.entries())
    .map(([time, count]) => ({ time, count, severity: 'mixed' }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

function findRelatedErrorPatterns(error: WebError): string[] {
  const patterns: string[] = [];
  const message = error.message.toLowerCase();
  
  if (message.includes('async')) patterns.push('Promise rejection', 'Async/await issue');
  if (message.includes('fetch')) patterns.push('Network request', 'API call');
  if (message.includes('dom')) patterns.push('DOM manipulation', 'Element access');
  if (message.includes('css')) patterns.push('CSS loading', 'Style application');
  if (message.includes('script')) patterns.push('JavaScript loading', 'Module import');
  
  return patterns;
}

function analyzePotentialCauses(error: WebError): string[] {
  const causes: string[] = [];
  const message = error.message.toLowerCase();
  
  if (error.type === 'network') {
    causes.push('Network connectivity issue', 'Server downtime', 'Invalid endpoint URL');
  }
  if (message.includes('timeout')) {
    causes.push('Slow network', 'Server performance issue', 'Large resource loading');
  }
  if (message.includes('permission')) {
    causes.push('Insufficient permissions', 'Security restrictions', 'Cross-origin access');
  }
  if (message.includes('load')) {
    causes.push('Missing resource', 'Incorrect file path', 'Build process issue');
  }
  
  return causes;
}

function generateAggregateStats() {
  const allSessions = Array.from(sessions.values());
  const allErrors = allSessions.flatMap(session => session.errors);
  
  return {
    totalSessions: allSessions.length,
    totalErrors: allErrors.length,
    averageErrorsPerSession: allSessions.length > 0 ? allErrors.length / allSessions.length : 0,
    errorsByType: {
      javascript: allErrors.filter(e => e.type === 'javascript').length,
      console: allErrors.filter(e => e.type === 'console').length,
      network: allErrors.filter(e => e.type === 'network').length,
      resource: allErrors.filter(e => e.type === 'resource').length
    },
    errorsBySeverity: {
      error: allErrors.filter(e => e.severity === 'error').length,
      warning: allErrors.filter(e => e.severity === 'warning').length,
      info: allErrors.filter(e => e.severity === 'info').length
    },
    topErrorPatterns: analyzeErrorPatterns(allErrors),
    lastUpdated: new Date().toISOString()
  };
}

// Cleanup function
async function cleanup() {
  if (browser && browser.isConnected()) {
    await browser.close();
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  console.error('Web Client Errors MCP Server started');
}

main().catch(async (error) => {
  console.error('Failed to start server:', error);
  await cleanup();
  process.exit(1);
});