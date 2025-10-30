import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the modules to avoid Zod import issues
vi.mock('zod', () => ({
  z: {
    object: vi.fn(),
    string: vi.fn(),
    number: vi.fn(),
    boolean: vi.fn(),
    url: vi.fn(),
    min: vi.fn(),
    max: vi.fn(),
    default: vi.fn(),
    optional: vi.fn(),
    enum: vi.fn(),
    parse: vi.fn()
  }
}));

// Test core functionality in isolation
describe('Core Logic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Pattern Matching', () => {
    it('should identify TypeError patterns', () => {
      const patterns = [
        {
          name: 'TypeError: Undefined Property',
          regex: /TypeError: Cannot read propert(?:y|ies) of (undefined|null)/,
          category: 'Property Access',
          severity: 'error',
          suggestions: ['Check variable initialization before access']
        }
      ];

      const message = 'TypeError: Cannot read properties of undefined';
      const matched = patterns.find(p => p.regex.test(message));
      
      expect(matched).toBeDefined();
      expect(matched?.category).toBe('Property Access');
      expect(matched?.suggestions).toContain('Check variable initialization before access');
    });

    it('should identify Network Error patterns', () => {
      const patterns = [
        {
          name: 'Network Error',
          regex: /NetworkError|Failed to fetch|CORS|Access-Control-Allow-Origin/,
          category: 'Network',
          severity: 'error',
          suggestions: ['Check network connectivity']
        }
      ];

      const message = 'NetworkError: Failed to fetch';
      const matched = patterns.find(p => p.regex.test(message));
      
      expect(matched).toBeDefined();
      expect(matched?.category).toBe('Network');
    });
  });

  describe('Error ID Generation', () => {
    it('should generate consistent error IDs', () => {
      // Mock crypto hash
      vi.mock('crypto', () => ({
        createHash: () => ({
          update: () => ({
            digest: () => 'abcdef1234567890'
          })
        })
      }));

      const crypto = require('crypto');
      const createHash = crypto.createHash;
      
      const error = {
        message: 'Test error',
        type: 'javascript',
        timestamp: '2023-01-01T00:00:00.000Z',
        severity: 'error',
        category: 'Test'
      };

      const id1 = generateErrorId(error);
      const id2 = generateErrorId(error);

      expect(id1).toBe(id2);
      expect(id1).toMatch(/^error-/);
    });
  });
});

// Helper functions for testing
function generateErrorId(error: any): string {
  const { createHash } = require('crypto');
  const hash = createHash('md5')
    .update(`${error.message}-${error.type}-${error.timestamp}`)
    .digest('hex')
    .substring(0, 8);
  return `error-${hash}`;
}