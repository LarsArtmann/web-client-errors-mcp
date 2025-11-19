import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { getAppLogger } from '../logger.js';
import { getConfig } from '../config.js';
import { SessionManager } from '../repositories/session-store.js';
import { ErrorDetectionService } from './error-detection.js';
import type { SessionId } from '../types/domain.js';

export class BrowserManager {
  private browser: Browser | null = null;
  private readonly logger = getAppLogger('browser-manager');
  private sessionManager: SessionManager;
  private errorDetection: ErrorDetectionService;
  private currentSessionId: SessionId | null = null;

  constructor(sessionManager?: SessionManager) {
    this.sessionManager = sessionManager || new SessionManager();
    this.errorDetection = new ErrorDetectionService();
  }

  setSession(sessionId: SessionId): void {
    this.currentSessionId = sessionId;
  }

  async initializeBrowser(): Promise<Browser> {
    const config = getConfig();
    
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.info('Initializing browser with configuration', { 
        headless: config.browser.headless,
        args: config.browser.args 
      });
      
      this.browser = await chromium.launch({
        headless: config.browser.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', ...config.browser.args]
      });
    }
    return this.browser;
  }

  async createContext(): Promise<BrowserContext> {
    const browser = await this.initializeBrowser();
    const config = getConfig();
    
    return await browser.newContext({
      viewport: config.browser.viewport,
      userAgent: config.browser.userAgent
    });
  }

  async createPageWithContext(sessionId: SessionId, context?: BrowserContext): Promise<Page> {
    this.setSession(sessionId);
    const ctx = context || await this.createContext();
    const page = await ctx.newPage();
    
    // Set up error listeners for real error detection
    this.setupErrorListeners(page);
    
    return page;
  }

  private setupErrorListeners(page: Page): void {
    // JavaScript error detection
    page.on('pageerror', async (error) => {
      this.logger.error('JavaScript error detected', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      // Create error using existing service
      const webError = this.errorDetection.createJavaScriptError(
        error.message,
        error.stack || 'No stack trace',
        0, // Line info available in error.message parsing
        0, // Column info available in error.message parsing
        page.url(),
        'high' // JS errors are high severity by default
      );

      // Store in session with deduplication
      if (this.currentSessionId) {
        await this.sessionManager.addError(this.currentSessionId, webError);
      }
    });

    // Console error detection
    page.on('console', async (msg) => {
      if (msg.type() === 'error') {
        this.logger.error('Console error detected', {
          message: msg.text(),
          location: msg.location()
        });
        
        const webError = this.errorDetection.createJavaScriptError(
          msg.text(),
          `Console error at ${msg.location()?.url}:${msg.location()?.lineNumber}:${msg.location()?.columnNumber}`,
          msg.location()?.lineNumber || 0,
          msg.location()?.columnNumber || 0,
          page.url(),
          'medium' // Console errors might be less critical
        );

        // Store in session with deduplication
        if (this.currentSessionId) {
          await this.sessionManager.addError(this.currentSessionId, webError);
        }
      }
    });

    // Network error detection
    page.on('response', async (response) => {
      if (response.status() >= 400) {
        this.logger.error('Network error detected', {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
        
        const webError = this.errorDetection.createNetworkError(
          `HTTP ${response.status()}: ${response.statusText()}`,
          response.url(),
          0, // Response time would need tracking
          response.status(),
          response.status() >= 500 ? 'high' : 'medium'
        );

        // Store in session with deduplication
        if (this.currentSessionId) {
          await this.sessionManager.addError(this.currentSessionId, webError);
        }
      }
    });

    // Request failure detection
    page.on('requestfailed', async (request) => {
      this.logger.error('Request failed', {
        url: request.url(),
        failure: request.failure()?.errorText
      });
      
      const webError = this.errorDetection.createNetworkError(
        request.failure()?.errorText || 'Request failed',
        request.url(),
        0,
        0,
        'high'
      );

      // Store in session with deduplication
      if (this.currentSessionId) {
        await this.sessionManager.addError(this.currentSessionId, webError);
      }
    });
  }

  /**
   * Captures a screenshot of the current page
   * @param page - Playwright page instance
   * @param quality - JPEG quality (1-100), only for JPEG format
   * @returns Base64-encoded screenshot string
   */
  async captureScreenshot(
    page: Page,
    options: {
      quality?: number;
      type?: 'png' | 'jpeg';
      fullPage?: boolean;
    } = {}
  ): Promise<string> {
    try {
      const screenshot = await page.screenshot({
        type: options.type || 'png',
        quality: options.quality || 80,
        fullPage: options.fullPage !== false // Default to full page
      });

      this.logger.debug('Screenshot captured', {
        type: options.type || 'png',
        fullPage: options.fullPage !== false
      });

      // Convert Buffer to base64 string
      return screenshot.toString('base64');
    } catch (error) {
      this.logger.error('Failed to capture screenshot', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Captures DOM snapshot with XSS sanitization
   * @param page - Playwright page instance
   * @param maxSize - Maximum size in bytes (default: 100KB)
   * @returns Sanitized HTML snapshot
   */
  async captureDOMSnapshot(
    page: Page,
    maxSize: number = 100_000
  ): Promise<{ exists: boolean; data?: string; size: number }> {
    try {
      const html = await page.content();

      // Import sanitization dynamically to avoid circular dependency
      const { sanitizeHTML } = await import('../utils/sanitize.js');
      const sanitized = sanitizeHTML(html, maxSize);

      this.logger.debug('DOM snapshot captured', {
        originalSize: html.length,
        sanitizedSize: sanitized.length,
        truncated: sanitized.includes('[truncated]')
      });

      return {
        exists: true,
        data: sanitized,
        size: sanitized.length
      };
    } catch (error) {
      this.logger.error('Failed to capture DOM snapshot', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        exists: false,
        size: 0
      };
    }
  }

  /**
   * Captures Web Vitals and performance metrics
   * @param page - Playwright page instance
   * @returns Performance metrics and Web Vitals with ratings
   */
  async capturePerformanceMetrics(page: Page): Promise<{
    metrics: import('../types/domain.js').PerformanceMetrics;
    vitals: Array<{
      name: string;
      value: number;
      rating: 'good' | 'needs-improvement' | 'poor';
      threshold: number;
    }>;
  }> {
    try {
      const { captureWebVitals, detectSlowOperations } = await import('./performance-metrics.js');
      const result = await captureWebVitals(page);

      // Detect slow operations and create performance errors
      const slowOps = detectSlowOperations(result.vitals);

      for (const slowOp of slowOps) {
        const performanceError: import('../types/domain.js').PerformanceError = {
          type: 'performance',
          id: (await import('../types/domain.js')).createErrorId(),
          message: (await import('../types/domain.js')).toNonEmptyString(
            `Slow ${slowOp.metric}: ${slowOp.value}ms (threshold: ${slowOp.threshold}ms)`
          ),
          timestamp: (await import('../types/domain.js')).toISO8601(),
          severity: slowOp.severity,
          frequency: 1,
          metric: slowOp.metric,
          value: slowOp.value,
          threshold: slowOp.threshold
        };

        // Store performance error in session
        if (this.currentSessionId) {
          await this.sessionManager.addError(this.currentSessionId, performanceError);
        }
      }

      this.logger.debug('Performance metrics captured', {
        vitalsCount: result.vitals.length,
        slowOpsCount: slowOps.length
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to capture performance metrics', {
        error: error instanceof Error ? error.message : String(error)
      });

      return {
        metrics: {
          domContentLoaded: 0,
          loadComplete: 0
        },
        vitals: []
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser && this.browser.isConnected()) {
      this.logger.info('Closing browser');
      await this.browser.close();
    }
  }

  async destroy(): Promise<void> {
    await this.cleanup();
    this.browser = null;
  }
}