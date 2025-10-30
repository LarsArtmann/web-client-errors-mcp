import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  classifyError, 
  generateErrorId, 
  createErrorSession,
  ERROR_PATTERNS 
} from './index';

// Mock the modules that require external dependencies
vi.mock('crypto', () => ({
  createHash: () => ({
    update: () => ({
      digest: () => 'abcdef1234567890'
    })
  })
}));

describe('Error Processing Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('classifyError', () => {
    it('should classify TypeError correctly', () => {
      const error = {
        message: 'TypeError: Cannot read properties of undefined',
        type: 'javascript' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        severity: 'error' as const
      };

      const result = classifyError(error);

      expect(result.category).toBe('Property Access');
      expect(result.severity).toBe('error');
      expect(result.suggestions).toContain('Check variable initialization before access');
    });

    it('should classify Network Error correctly', () => {
      const error = {
        message: 'NetworkError: Failed to fetch',
        type: 'network' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        severity: 'error' as const
      };

      const result = classifyError(error);

      expect(result.category).toBe('Network');
      expect(result.suggestions).toContain('Check network connectivity');
    });

    it('should return Unclassified for unknown errors', () => {
      const error = {
        message: 'Unknown error message',
        type: 'javascript' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        severity: 'error' as const
      };

      const result = classifyError(error);

      expect(result.category).toBe('Unclassified');
      expect(result.suggestions).toBeUndefined();
    });
  });

  describe('generateErrorId', () => {
    it('should generate consistent error IDs', () => {
      const error = {
        id: '',
        message: 'Test error',
        type: 'javascript' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        severity: 'error' as const,
        category: 'Test'
      };

      const id1 = generateErrorId(error);
      const id2 = generateErrorId(error);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^error-/);
    });
  });

  describe('createErrorSession', () => {
    it('should create session with default values', () => {
      const session = createErrorSession('https://example.com');

      expect(session.url).toBe('https://example.com');
      expect(session.id).toMatch(/^session-/);
      expect(session.errors).toEqual([]);
      expect(session.screenshots).toEqual([]);
      expect(session.metadata.userAgent).toBeDefined();
      expect(session.metadata.viewport).toEqual({ width: 1920, height: 1080 });
    });

    it('should create session with custom ID', () => {
      const customId = 'custom-session-id';
      const session = createErrorSession('https://example.com', customId);

      expect(session.id).toBe(customId);
    });
  });
});

describe('Error Patterns', () => {
  it('should have well-defined patterns', () => {
    expect(ERROR_PATTERNS).toBeDefined();
    expect(ERROR_PATTERNS.length).toBeGreaterThan(0);

    ERROR_PATTERNS.forEach(pattern => {
      expect(pattern.name).toBeDefined();
      expect(pattern.regex).toBeInstanceOf(RegExp);
      expect(pattern.category).toBeDefined();
      expect(pattern.severity).toBeDefined();
      expect(Array.isArray(pattern.suggestions)).toBe(true);
    });
  });
});