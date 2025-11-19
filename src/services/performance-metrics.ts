/**
 * Performance Metrics Service
 * Captures Core Web Vitals and detects performance issues
 *
 * Core Web Vitals:
 * - LCP (Largest Contentful Paint): Visual loading performance
 * - FID (First Input Delay): Interactivity and responsiveness
 * - CLS (Cumulative Layout Shift): Visual stability
 *
 * Additional Metrics:
 * - FCP (First Contentful Paint): Initial rendering
 * - TTFB (Time to First Byte): Server response time
 * - DOM Content Loaded: HTML parsing complete
 * - Load Complete: All resources loaded
 */

import type { Page } from 'playwright';
import { getAppLogger } from '../logger.js';
import type { PerformanceMetrics } from '../types/domain.js';

const logger = getAppLogger('performance-metrics');

/**
 * Web Vitals thresholds (in milliseconds)
 * Based on Google's Core Web Vitals recommendations
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: {
    good: 2500,      // < 2.5s = Good
    needsWork: 4000  // 2.5s - 4s = Needs Improvement, > 4s = Poor
  },
  FID: {
    good: 100,       // < 100ms = Good
    needsWork: 300   // 100ms - 300ms = Needs Improvement, > 300ms = Poor
  },
  CLS: {
    good: 0.1,       // < 0.1 = Good
    needsWork: 0.25  // 0.1 - 0.25 = Needs Improvement, > 0.25 = Poor
  },
  FCP: {
    good: 1800,      // < 1.8s = Good
    needsWork: 3000  // 1.8s - 3s = Needs Improvement, > 3s = Poor
  },
  TTFB: {
    good: 800,       // < 800ms = Good
    needsWork: 1800  // 800ms - 1.8s = Needs Improvement, > 1.8s = Poor
  }
} as const;

/**
 * Performance metric result
 */
export interface WebVital {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  threshold: number;
}

/**
 * Captures Core Web Vitals and performance metrics from a page
 */
export async function captureWebVitals(page: Page): Promise<{
  metrics: PerformanceMetrics;
  vitals: WebVital[];
}> {
  try {
    // Get performance timing data from the browser
    const performanceData = await page.evaluate(() => {
      const perf = window.performance;
      const navigation = perf.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = perf.getEntriesByType('paint');

      return {
        // Navigation timing
        domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart || 0,
        loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart || 0,

        // Paint timing
        firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0,

        // Server timing
        ttfb: navigation?.responseStart - navigation?.requestStart || 0,

        // Resource timing
        domInteractive: navigation?.domInteractive || 0,
        domComplete: navigation?.domComplete || 0
      };
    });

    // Capture Web Vitals using web-vitals approach
    const webVitals = await page.evaluate(() => {
      return new Promise<{
        lcp?: number;
        fid?: number;
        cls?: number;
      }>((resolve) => {
        const vitals: { lcp?: number; fid?: number; cls?: number } = {};

        // Largest Contentful Paint (LCP)
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };
          vitals.lcp = lastEntry.renderTime || lastEntry.loadTime || 0;
        });

        try {
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch {
          // LCP not supported
        }

        // Cumulative Layout Shift (CLS)
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const layoutShift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
            if (!layoutShift.hadRecentInput) {
              clsValue += layoutShift.value || 0;
            }
          }
          vitals.cls = clsValue;
        });

        try {
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch {
          // CLS not supported
        }

        // First Input Delay (FID)
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const firstInput = entries[0] as PerformanceEntry & { processingStart?: number };
          vitals.fid = firstInput.processingStart ? firstInput.processingStart - firstInput.startTime : 0;
        });

        try {
          fidObserver.observe({ type: 'first-input', buffered: true });
        } catch {
          // FID not supported
        }

        // Wait a bit for metrics to be collected, then resolve
        setTimeout(() => {
          lcpObserver.disconnect();
          clsObserver.disconnect();
          fidObserver.disconnect();
          resolve(vitals);
        }, 2000); // Wait 2 seconds for metrics to stabilize
      });
    });

    // Combine all metrics
    const metrics: PerformanceMetrics = {
      domContentLoaded: Math.round(performanceData.domContentLoaded),
      loadComplete: Math.round(performanceData.loadComplete),
      firstContentfulPaint: Math.round(performanceData.firstContentfulPaint),
      largestContentfulPaint: webVitals.lcp ? Math.round(webVitals.lcp) : undefined,
      cumulativeLayoutShift: webVitals.cls !== undefined ? Number(webVitals.cls.toFixed(3)) : undefined,
      firstInputDelay: webVitals.fid ? Math.round(webVitals.fid) : undefined
    };

    // Evaluate each vital against thresholds
    const vitals: WebVital[] = [];

    if (metrics.largestContentfulPaint !== undefined) {
      vitals.push({
        name: 'LCP',
        value: metrics.largestContentfulPaint,
        rating: getRating(metrics.largestContentfulPaint, WEB_VITALS_THRESHOLDS.LCP),
        threshold: WEB_VITALS_THRESHOLDS.LCP.good
      });
    }

    if (metrics.firstInputDelay !== undefined) {
      vitals.push({
        name: 'FID',
        value: metrics.firstInputDelay,
        rating: getRating(metrics.firstInputDelay, WEB_VITALS_THRESHOLDS.FID),
        threshold: WEB_VITALS_THRESHOLDS.FID.good
      });
    }

    if (metrics.cumulativeLayoutShift !== undefined) {
      vitals.push({
        name: 'CLS',
        value: metrics.cumulativeLayoutShift,
        rating: getRating(metrics.cumulativeLayoutShift, WEB_VITALS_THRESHOLDS.CLS),
        threshold: WEB_VITALS_THRESHOLDS.CLS.good
      });
    }

    if (metrics.firstContentfulPaint !== undefined) {
      vitals.push({
        name: 'FCP',
        value: metrics.firstContentfulPaint,
        rating: getRating(metrics.firstContentfulPaint, WEB_VITALS_THRESHOLDS.FCP),
        threshold: WEB_VITALS_THRESHOLDS.FCP.good
      });
    }

    logger.info('Web Vitals captured', {
      lcp: metrics.largestContentfulPaint,
      fid: metrics.firstInputDelay,
      cls: metrics.cumulativeLayoutShift,
      fcp: metrics.firstContentfulPaint
    });

    return { metrics, vitals };
  } catch (error) {
    logger.error('Failed to capture Web Vitals', {
      error: error instanceof Error ? error.message : String(error)
    });

    // Return empty metrics on error
    return {
      metrics: {
        domContentLoaded: 0,
        loadComplete: 0
      },
      vitals: []
    };
  }
}

/**
 * Determines the rating for a metric value
 */
function getRating(
  value: number,
  threshold: { good: number; needsWork: number }
): 'good' | 'needs-improvement' | 'poor' {
  if (value <= threshold.good) return 'good';
  if (value <= threshold.needsWork) return 'needs-improvement';
  return 'poor';
}

/**
 * Detects slow operations and returns performance errors
 */
export function detectSlowOperations(vitals: WebVital[]): Array<{
  metric: string;
  value: number;
  threshold: number;
  severity: 'medium' | 'high' | 'critical';
}> {
  const slowOps: Array<{
    metric: string;
    value: number;
    threshold: number;
    severity: 'medium' | 'high' | 'critical';
  }> = [];

  for (const vital of vitals) {
    if (vital.rating === 'poor') {
      slowOps.push({
        metric: vital.name,
        value: vital.value,
        threshold: vital.threshold,
        severity: 'high'
      });
    } else if (vital.rating === 'needs-improvement') {
      slowOps.push({
        metric: vital.name,
        value: vital.value,
        threshold: vital.threshold,
        severity: 'medium'
      });
    }
  }

  return slowOps;
}

/**
 * Formats performance metrics for display
 */
export function formatPerformanceMetrics(metrics: PerformanceMetrics): string {
  const lines: string[] = [];

  if (metrics.firstContentfulPaint) {
    lines.push(`FCP: ${metrics.firstContentfulPaint}ms`);
  }
  if (metrics.largestContentfulPaint) {
    lines.push(`LCP: ${metrics.largestContentfulPaint}ms`);
  }
  if (metrics.firstInputDelay) {
    lines.push(`FID: ${metrics.firstInputDelay}ms`);
  }
  if (metrics.cumulativeLayoutShift !== undefined) {
    lines.push(`CLS: ${metrics.cumulativeLayoutShift}`);
  }
  if (metrics.domContentLoaded) {
    lines.push(`DOM Ready: ${metrics.domContentLoaded}ms`);
  }
  if (metrics.loadComplete) {
    lines.push(`Load Complete: ${metrics.loadComplete}ms`);
  }

  return lines.join(', ');
}
