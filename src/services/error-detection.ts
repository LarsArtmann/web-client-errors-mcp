import { 
  type WebError, 
  type SessionId, 
  createErrorId, 
  type ErrorSeverity, 
  createJavaScriptError, 
  createNetworkError,
  type JavaScriptError,
  type NetworkError,
  toISO8601,
  ErrorId
} from '../types/domain.js';
import { getAppLogger } from '../logger.js';

// Enhanced error pattern definitions for intelligent classification
interface ErrorPattern {
  name: string;
  regex: RegExp;
  category: string;
  severity: ErrorSeverity;
  suggestions: string[];
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    name: 'TypeError: Undefined Property',
    regex: /TypeError: Cannot read propert(?:y|ies) of (undefined|null)|TypeError: Cannot read property \w+ of (undefined|null)/,
    category: 'Property Access',
    severity: 'high',
    suggestions: [
      'Check variable initialization before access',
      'Use optional chaining (?.) for safer property access',
      'Add null/undefined checks before property access'
    ]
  },
  {
    name: 'ReferenceError: Not Defined',
    regex: /ReferenceError: \w+ is not defined/,
    category: 'Variable Reference',
    severity: 'high',
    suggestions: [
      'Verify variable declaration',
      'Check for typos in variable names',
      'Ensure proper scope and hoisting'
    ]
  },
  {
    name: 'Network Error',
    regex: /NetworkError|Failed to fetch|CORS|Access-Control-Allow-Origin/,
    category: 'Network',
    severity: 'medium',
    suggestions: [
      'Check network connectivity',
      'Verify CORS configuration',
      'Validate API endpoint availability'
    ]
  },
  {
    name: 'Promise Rejection',
    regex: /UnhandledPromiseRejectionWarning|Promise rejected/,
    category: 'Async Handling',
    severity: 'low',
    suggestions: [
      'Add .catch() handler to promises',
      'Use try/catch with async/await',
      'Implement proper error boundaries'
    ]
  },
  {
    name: '404 Not Found',
    regex: /404|Not Found/,
    category: 'Resource',
    severity: 'medium',
    suggestions: [
      'Verify resource URL exists',
      'Check file path spelling',
      'Confirm deployment included all assets'
    ]
  },
  {
    name: '500 Server Error',
    regex: /500|Internal Server Error/,
    category: 'Server',
    severity: 'critical',
    suggestions: [
      'Check server logs for details',
      'Verify server configuration',
      'Contact server administrator if needed'
    ]
  }
];

export class ErrorDetectionService {
  private readonly logger = getAppLogger('error-detection');

  classifyError(error: Partial<WebError>): WebError {
    const message = error.message || '';
    
    // Pattern matching for intelligent classification
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.regex.test(message)) {
        // Create specific error type based on classification
        if (error.type === 'javascript') {
          const jsError = error as Partial<JavaScriptError>;
          return createJavaScriptError(
            message,
            jsError.stack || 'No stack trace available',
            jsError.line || 0,
            jsError.column || 0,
            jsError.url || 'Unknown URL',
            pattern.severity
          );
        } else if (error.type === 'network') {
          const netError = error as Partial<NetworkError>;
          return createNetworkError(
            message,
            netError.url || 'Unknown URL',
            netError.responseTime || 0,
            netError.statusCode || 0,
            pattern.severity
          );
        }
      }
    }

    // Default classification - create JavaScript error as fallback
    const jsError = error as Partial<JavaScriptError>;
    return createJavaScriptError(
      message,
      jsError.stack || 'No stack trace available',
      jsError.line || 0,
      jsError.column || 0,
      jsError.url || 'Unknown URL',
      error.severity || 'medium'
    );
  }

  createJavaScriptError(
    message: string,
    stack: string,
    line: number,
    column: number,
    url: string,
    severity: ErrorSeverity = 'medium'
  ): WebError {
    return createJavaScriptError(message, stack, line, column, url, severity);
  }

  createNetworkError(
    message: string,
    url: string,
    responseTime: number,
    statusCode?: number,
    severity: ErrorSeverity = 'medium'
  ): WebError {
    return createNetworkError(message, url, responseTime, statusCode, severity);
  }

  getErrorPatterns(): readonly ErrorPattern[] {
    return ERROR_PATTERNS;
  }

  analyzeErrorPatterns(errors: readonly WebError[]): string[] {
    const patterns = new Map<string, number>();
    
    errors.forEach(error => {
      const pattern = this.extractErrorPattern(error.message);
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });

    return Array.from(patterns.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([pattern]) => pattern);
  }

  getMostCommonErrors(errors: readonly WebError[]): Array<{message: string, count: number, type: WebError['type']}> {
    const errorCounts = new Map<string, {count: number, type: WebError['type']}>();
    
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

  generateErrorSuggestions(errors: readonly WebError[]): string[] {
    const suggestions: string[] = [];
    
    errors.forEach(error => {
      if (error.message.includes('undefined')) {
        suggestions.push('Check if variable is properly initialized before use');
        suggestions.push('Use optional chaining (?.) for safer property access');
        suggestions.push('Add null/undefined checks before property access');
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

  private extractErrorPattern(message: string): string {
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
}