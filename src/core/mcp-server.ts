#!/usr/bin/env bun

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema 
} from '@modelcontextprotocol/sdk/types.js';
import { initializeLogging, getAppLogger } from '../logger.js';
import { getConfig } from '../config.js';
import type { MCPResponse, CallToolRequest } from '../types.js';
import { isCallToolRequest, hasValidArguments } from '../types.js';
import { SessionManager } from '../repositories/session-store.js';
import { ErrorDetectionService } from '../services/error-detection.js';
import { BrowserManager } from '../services/browser-manager.js';

// Initialize logging
initializeLogging();
const logger = getAppLogger('mcp-server');

// Initialize services
const sessionManager = new SessionManager();
const browserManager = new BrowserManager();
const errorDetectionService = new ErrorDetectionService();

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
  
  // TODO: Implement proper schema validation with domain types
  const options = request.params.arguments;
  
  // URL validation
  try {
    new URL(options.url as string);
  } catch {
    return {
      content: [{ 
        type: 'text', 
        text: JSON.stringify({ error: 'Invalid URL provided' }) 
      }]
    };
  }
  
  logger.info('Starting error detection', { url: options.url });
  
  // TODO: Implement with proper error detection service
  return {
    content: [{ 
      type: 'text', 
      text: JSON.stringify({ 
        message: 'Error detection service refactor in progress',
        url: options.url 
      }, null, 2) 
    }]
  };
}

async function handleAnalyzeErrorSession(request: CallToolRequest): Promise<MCPResponse> {
  // TODO: Implement with proper session management
  return {
    content: [{ 
      type: 'text', 
      text: JSON.stringify({ message: 'Session analysis refactor in progress' }) 
    }]
  };
}

async function handleGetErrorDetails(request: CallToolRequest): Promise<MCPResponse> {
  // TODO: Implement with proper error lookup
  return {
    content: [{ 
      type: 'text', 
      text: JSON.stringify({ message: 'Error details refactor in progress' }) 
    }]
  };
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
    // TODO: Implement with proper error store
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          totalErrors: 0,
          errors: [],
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  if (uri === 'errors://stats') {
    // TODO: Implement with proper analytics
    return {
      contents: [{
        uri,
        mimeType: 'application/json', 
        text: JSON.stringify({
          totalSessions: 0,
          totalErrors: 0,
          lastUpdated: new Date().toISOString()
        }, null, 2)
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