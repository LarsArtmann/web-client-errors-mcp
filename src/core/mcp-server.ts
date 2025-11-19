#!/usr/bin/env bun

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { initializeLogging, getAppLogger } from '../logger.js';
import { getConfig } from '../config.js';
import type { MCPResponse, CallToolRequest } from '../types.js';
import { isCallToolRequest, hasValidArguments } from '../types.js';
import { SessionManager } from '../repositories/session-store.js';
import { ErrorDetectionService } from '../services/error-detection.js';
import { BrowserManager } from '../services/browser-manager.js';
import type { WebError, SessionId } from '../types/domain.js';
import { toNonEmptyString, toISO8601 } from '../types/domain.js';
import { createRateLimiter } from '../utils/rate-limiter.js';

// Initialize logging
initializeLogging();
const logger = getAppLogger('mcp-server');

// Initialize services
const sessionManager = new SessionManager();
const browserManager = new BrowserManager(sessionManager); // Pass sessionManager to share instance!
const errorDetectionService = new ErrorDetectionService();

// Initialize rate limiter: 10 requests per minute per URL
const rateLimiter = createRateLimiter({
  limit: 10,
  windowSeconds: 60
});

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

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  // Type guard to ensure we have a valid CallToolRequest
  if (!isCallToolRequest(request)) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Invalid tool request' }) 
      }]
    };
  }
  const { name } = request.params;
  
  try {
    switch (name) {
      case 'detect_errors':
        return await handleDetectErrors(request);
      case 'analyze_error_session':
        return await handleAnalyzeErrorSession(request);
      case 'get_error_details':
        return await handleGetErrorDetails(request);
      default:
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Unknown tool' }) 
          }] 
        };
    }
  } catch (error) {
    logger.error('Tool execution failed', { 
      tool: name, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: 'Tool execution failed', 
          details: error instanceof Error ? error.message : String(error)
        }) 
      }]
    };
  }
});

async function handleDetectErrors(request: CallToolRequest): Promise<MCPResponse> {
  if (!hasValidArguments(request)) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Missing or invalid arguments for detect_errors' }) 
      }]
    };
  }
  
  try {
    const options = DetectErrorsSchema.parse(request.params.arguments);

    // Rate limit check: 10 requests per minute per URL
    const limitCheck = await rateLimiter.checkLimit(options.url);
    if (!limitCheck.ok) {
      const { retryAfter, limit, window } = limitCheck.error;
      logger.warn('Rate limit exceeded', {
        url: options.url,
        limit,
        window,
        retryAfter
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please retry after ${retryAfter} seconds.`,
            limit,
            window,
            retryAfter
          })
        }]
      };
    }

    logger.info('Starting error detection', { url: options.url, sessionId: options.sessionId });

    // Create session
    const config = getConfig();
    const sessionId = sessionManager.createSession(options.url, {
      userAgent: toNonEmptyString(config.browser.userAgent),
      viewport: config.browser.viewport,
      platform: 'unknown',
      language: 'en-US',
      cookiesEnabled: true,
      javascriptEnabled: true,
      onlineStatus: true
    }, options.sessionId as SessionId | undefined);
    
    // Initialize browser and start detection
    const context = await browserManager.createContext();
    const page = await browserManager.createPageWithContext(sessionId, context);
    
    try {
      // Navigate to the URL
      await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 10000 });

      // Detect framework after page load
      const { detectFramework } = await import('../services/framework-detection.js');
      const frameworkInfo = await detectFramework(page);

      // Update session with framework info
      const currentSessionAfterNav = sessionManager.getSession(sessionId);
      if (currentSessionAfterNav && frameworkInfo.name !== 'Unknown') {
        sessionManager.updateSession(sessionId, {
          ...currentSessionAfterNav,
          metadata: {
            ...currentSessionAfterNav.metadata,
            framework: {
              name: frameworkInfo.name,
              version: frameworkInfo.version,
              confidence: frameworkInfo.confidence
            }
          }
        });

        logger.info('Framework detected', {
          framework: frameworkInfo.name,
          version: frameworkInfo.version,
          confidence: frameworkInfo.confidence
        });
      }

      // Wait for the specified time to collect errors
      if (options.interactWithPage) {
        // Basic interaction - scroll and click some elements
        await page.evaluate(() => {
          // This code runs in the browser context
          window.scrollTo(0, document.body.scrollHeight / 2);
        });
        await page.waitForTimeout(options.waitTime / 2);
      }
      
      // Wait for remaining time
      await page.waitForTimeout(options.waitTime);

      // Capture screenshot if requested
      if (options.captureScreenshot) {
        try {
          const screenshot = await browserManager.captureScreenshot(page, {
            type: 'png',
            quality: 80,
            fullPage: true
          });

          // Add screenshot to session
          const currentSession = sessionManager.getSession(sessionId);
          if (currentSession) {
            sessionManager.updateSession(sessionId, {
              ...currentSession,
              screenshots: [...currentSession.screenshots, screenshot]
            });
          }
        } catch (error) {
          logger.error('Screenshot capture failed', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Capture DOM snapshot if configured
      if (config.features.domSnapshots) {
        try {
          const domSnapshot = await browserManager.captureDOMSnapshot(page, 100_000);

          // Add DOM snapshot to session metadata
          const currentSession = sessionManager.getSession(sessionId);
          if (currentSession) {
            sessionManager.updateSession(sessionId, {
              ...currentSession,
              metadata: {
                ...currentSession.metadata,
                domSnapshot: {
                  exists: domSnapshot.exists,
                  data: domSnapshot.data,
                  size: domSnapshot.size,
                  timestamp: toISO8601()
                }
              }
            });
          }
        } catch (error) {
          logger.error('DOM snapshot capture failed', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Capture Web Vitals performance metrics
      if (config.features.performanceMetrics !== false) {
        try {
          const perfResult = await browserManager.capturePerformanceMetrics(page);

          // Add performance metrics to session metadata
          const currentSession = sessionManager.getSession(sessionId);
          if (currentSession) {
            sessionManager.updateSession(sessionId, {
              ...currentSession,
              metadata: {
                ...currentSession.metadata,
                performanceMetrics: perfResult.metrics
              }
            });
          }

          logger.info('Web Vitals captured', {
            vitals: perfResult.vitals.map(v => `${v.name}:${v.value}(${v.rating})`).join(', ')
          });
        } catch (error) {
          logger.error('Performance metrics capture failed', {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Get the session with collected errors
      const updatedSession = sessionManager.getSession(sessionId);
      
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            sessionId: updatedSession?.id,
            url: options.url,
            message: 'Error detection completed successfully',
            status: 'completed',
            timestamp: new Date().toISOString(),
            errorsCollected: updatedSession?.errors.length || 0,
            errors: updatedSession?.errors.map(error => ({
              id: error.id,
              type: error.type,
              severity: error.severity,
              message: error.message,
              timestamp: error.timestamp
            })) || [],
            configuration: {
              waitTime: options.waitTime,
              captureScreenshot: options.captureScreenshot,
              includeNetworkErrors: options.includeNetworkErrors,
              includeConsoleWarnings: options.includeConsoleWarnings,
              interactWithPage: options.interactWithPage
            }
          }, null, 2) 
        }]
      };
    } finally {
      // Cleanup page and context
      await page.close();
      await context.close();
    }
  } catch (error) {
    logger.error('Error detection failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: 'Error detection failed', 
          details: error instanceof Error ? error.message : String(error)
        }) 
      }]
    };
  }
}

async function handleAnalyzeErrorSession(request: CallToolRequest): Promise<MCPResponse> {
  if (!hasValidArguments(request)) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Missing or invalid arguments for analyze_error_session' }) 
      }]
    };
  }
  
  try {
    const options = AnalyzeErrorsSchema.parse(request.params.arguments);
    const session = sessionManager.getSession(options.sessionId as SessionId);

    if (!session) {
      return {
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            error: 'Session not found. Note: Sessions are stateless and only exist during the current MCP server process.',
            sessionId: options.sessionId,
            suggestion: 'Use the same MCP server connection for session persistence or create a new session first.'
          }) 
        }]
      };
    }

    // Get errors from session
    const errors = session.errors;
    
    // Analyze patterns using error detection service
    const errorPatterns = errorDetectionService.analyzeErrorPatterns(errors);
    const commonErrors = errorDetectionService.getMostCommonErrors(errors);
    const suggestions = options.includeSuggestions ? 
      errorDetectionService.generateErrorSuggestions(errors) : [];

    const analysis = {
      sessionId: session.id,
      url: session.url,
      timestamp: session.startTime,
      totalErrors: errors.length,
      errorPatterns,
      commonErrors,
      suggestions,
      timeline: errors.map(error => ({
        timestamp: error.timestamp,
        type: error.type,
        severity: error.severity,
        message: error.message.substring(0, 100) + (error.message.length > 100 ? '...' : '')
      })),
      severityBreakdown: {
        low: errors.filter(e => e.severity === 'low').length,
        medium: errors.filter(e => e.severity === 'medium').length,
        high: errors.filter(e => e.severity === 'high').length,
        critical: errors.filter(e => e.severity === 'critical').length
      }
    };

    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(analysis, null, 2) 
      }]
    };
  } catch (error) {
    logger.error('Session analysis failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: 'Session analysis failed', 
          details: error instanceof Error ? error.message : String(error)
        }) 
      }]
    };
  }
}

async function handleGetErrorDetails(request: CallToolRequest): Promise<MCPResponse> {
  if (!hasValidArguments(request)) {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Missing or invalid arguments for get_error_details' }) 
      }]
    };
  }
  
  try {
    const options = GetErrorDetailsSchema.parse(request.params.arguments);
    
    // Search for error across all sessions
    const allSessions = sessionManager.getAllSessions();
    let targetError: WebError | null = null;
    
    for (const session of allSessions) {
      const error = session.errors.find(e => 
        e.id.includes(options.errorId) || 
        e.message.includes(options.errorId) ||
        (e.type === 'javascript' && e.stack?.includes(options.errorId))
      );
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

    // Generate analysis using error detection service
    const suggestions = errorDetectionService.generateErrorSuggestions([targetError]);
    
    const details = {
      ...targetError,
      suggestions,
      analysis: {
        frequency: targetError.frequency || 1,
        patternType: errorDetectionService.analyzeErrorPatterns([targetError])[0],
        potentialCauses: [
          targetError.type === 'javascript' ? 'Code execution error' : null,
          targetError.type === 'network' ? 'Network connectivity issue' : null,
          targetError.type === 'resource' ? 'Resource loading failure' : null
        ].filter(Boolean),
        recommendations: suggestions.slice(0, 3) // Top 3 recommendations
      }
    };

    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify(details, null, 2) 
      }]
    };
  } catch (error) {
    logger.error('Error details retrieval failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ 
          error: 'Error details retrieval failed', 
          details: error instanceof Error ? error.message : String(error)
        }) 
      }]
    };
  }
}

// Resource handlers
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
    try {
      const allSessions = sessionManager.getAllSessions();
      const allErrors = allSessions
        .flatMap(session => session.errors)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 100); // Last 100 errors

      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            totalErrors: allErrors.length,
            errors: allErrors.map(error => ({
              id: error.id,
              type: error.type,
              severity: error.severity,
              message: error.message,
              timestamp: error.timestamp,
              frequency: error.frequency
            })),
            lastUpdated: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get recent errors', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to retrieve recent errors',
            details: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
  }

  if (uri === 'errors://stats') {
    try {
      const allSessions = sessionManager.getAllSessions();
      const allErrors = allSessions.flatMap(session => session.errors);
      
      // Calculate statistics
      const errorsByType = allErrors.reduce((acc, error) => {
        acc[error.type] = (acc[error.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const errorsBySeverity = allErrors.reduce((acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const errorPatterns = errorDetectionService.analyzeErrorPatterns(allErrors);

      return {
        contents: [{
          uri,
          mimeType: 'application/json', 
          text: JSON.stringify({
            totalSessions: allSessions.length,
            totalErrors: allErrors.length,
            averageErrorsPerSession: allSessions.length > 0 ? allErrors.length / allSessions.length : 0,
            errorsByType,
            errorsBySeverity,
            topErrorPatterns: errorPatterns.slice(0, 10),
            lastUpdated: new Date().toISOString()
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to generate statistics', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({
            error: 'Failed to generate statistics',
            details: error instanceof Error ? error.message : String(error)
          }, null, 2)
        }]
      };
    }
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

// Cleanup function
async function cleanup() {
  logger.info('Starting cleanup process');
  await browserManager.destroy();
  sessionManager.destroy();
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, starting graceful shutdown');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, starting graceful shutdown');
  await cleanup();
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  logger.info('Web Client Errors MCP Server started');
}

main().catch(async (error) => {
  logger.error('Failed to start server', { error: error instanceof Error ? error.message : String(error) });
  await cleanup();
  process.exit(1);
});