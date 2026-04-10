import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
} from "playwright";
import { getAppLogger } from "../logger.js";
import { getConfig } from "../config.js";
import { SessionManager } from "../repositories/session-store.js";
import type { SessionId, WebError } from "../types/domain.js";
import { createJavaScriptError, createNetworkError } from "../types/domain.js";

export class BrowserManager {
  private browser: Browser | null = null;
  private readonly logger = getAppLogger("browser-manager");
  private sessionManager: SessionManager;
  private currentSessionId: SessionId | null = null;

  constructor(sessionManager?: SessionManager) {
    this.sessionManager = sessionManager || new SessionManager();
  }

  setSession(sessionId: SessionId): void {
    this.currentSessionId = sessionId;
  }

  async initializeBrowser(): Promise<Browser> {
    const config = getConfig();

    if (!this.browser || !this.browser.isConnected()) {
      this.logger.info("Initializing browser with configuration", {
        headless: config.browser.headless,
        args: config.browser.args,
      });

      this.browser = await chromium.launch({
        headless: config.browser.headless,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          ...config.browser.args,
        ],
      });
    }
    return this.browser;
  }

  async createContext(): Promise<BrowserContext> {
    const browser = await this.initializeBrowser();
    const config = getConfig();

    return await browser.newContext({
      viewport: config.browser.viewport,
      userAgent: config.browser.userAgent,
    });
  }

  async createPageWithContext(
    sessionId: SessionId,
    context?: BrowserContext,
  ): Promise<Page> {
    this.setSession(sessionId);
    const ctx = context || (await this.createContext());
    const page = await ctx.newPage();

    // Set up error listeners for real error detection
    this.setupErrorListeners(page);

    return page;
  }

  private storeError(webError: WebError): void {
    if (this.currentSessionId) {
      this.sessionManager.addError(this.currentSessionId, webError);
    }
  }

  private setupErrorListeners(page: Page): void {
    // JavaScript error detection
    page.on("pageerror", (error) => {
      this.logger.error("JavaScript error detected", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });

      const webError = createJavaScriptError(
        error.message,
        error.stack || "No stack trace",
        0,
        0,
        page.url(),
        "high",
      );

      this.storeError(webError);
    });

    // Console error detection
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        this.logger.error("Console error detected", {
          message: msg.text(),
          location: msg.location(),
        });

        const webError = createJavaScriptError(
          msg.text(),
          `Console error at ${msg.location()?.url}:${msg.location()?.lineNumber}:${msg.location()?.columnNumber}`,
          msg.location()?.lineNumber || 0,
          msg.location()?.columnNumber || 0,
          page.url(),
          "medium",
        );

        this.storeError(webError);
      }
    });

    // Network error detection
    page.on("response", (response) => {
      if (response.status() >= 400) {
        this.logger.error("Network error detected", {
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        });

        const webError = createNetworkError(
          `HTTP ${response.status()}: ${response.statusText()}`,
          response.url(),
          0,
          response.status(),
          response.status() >= 500 ? "high" : "medium",
        );

        this.storeError(webError);
      }
    });

    // Request failure detection
    page.on("requestfailed", (request) => {
      this.logger.error("Request failed", {
        url: request.url(),
        failure: request.failure()?.errorText,
      });

      const webError = createNetworkError(
        request.failure()?.errorText || "Request failed",
        request.url(),
        0,
        0,
        "high",
      );

      this.storeError(webError);
    });
  }

  async cleanup(): Promise<void> {
    if (this.browser && this.browser.isConnected()) {
      this.logger.info("Closing browser");
      await this.browser.close();
    }
  }

  async destroy(): Promise<void> {
    await this.cleanup();
    this.browser = null;
  }
}
