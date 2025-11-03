import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { getAppLogger } from '../logger.js';
import { getConfig } from '../config.js';

export class BrowserManager {
  private browser: Browser | null = null;
  private readonly logger = getAppLogger('browser-manager');

  async initializeBrowser(): Promise<Browser> {
    const config = getConfig();
    
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.info('Initializing browser with configuration', { 
        headless: config.browser.headless,
        args: config.browser.args 
      });
      
      this.browser = await chromium.launch({
        headless: config.browser.headless,
        args: config.browser.args
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

  async createPage(context?: BrowserContext): Promise<Page> {
    const ctx = context || await this.createContext();
    return await ctx.newPage();
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