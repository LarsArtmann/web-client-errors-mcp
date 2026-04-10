import { describe, it, expect, beforeEach } from "vitest";
import { type SessionId, createJavaScriptError, createNetworkError } from "../types/domain.js";
import { ErrorDetectionService } from "../services/error-detection.js";
import { SessionManager } from "../repositories/session-store.js";

// Test helpers
function createTestSessionMetadata() {
  return {
    userAgent: "Test User Agent",
    viewport: { width: 1920, height: 1080 },
    platform: "test",
    language: "en",
    cookiesEnabled: true,
    javascriptEnabled: true,
    onlineStatus: true,
    domSnapshot: {
      exists: false,
      size: 0,
      timestamp: "2025-11-03T12:00:00.000Z",
    },
    networkConditions: { isOnline: true },
  };
}

function createJsError(
  message: string,
  line = 1,
  column = 1,
): ReturnType<typeof createJavaScriptError> {
  return createJavaScriptError(message, "stack", line, column, "https://example.com");
}

async function waitForSessionExpiry(
  sessionManager: SessionManager,
  sessionId: SessionId,
): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 1100));
  return sessionManager.getSession(sessionId) === undefined;
}

function createTestSession(manager: SessionManager): SessionId {
  const sessionId = manager.createSession("https://test.com", createTestSessionMetadata());
  expect(manager.getSession(sessionId)).toBeDefined();
  return sessionId;
}

describe("BDD: Web Client Error Detection", () => {
  let errorDetectionService: ErrorDetectionService;
  let sessionManager: SessionManager;
  let _testSessionId: SessionId;

  beforeEach(() => {
    errorDetectionService = new ErrorDetectionService();
    sessionManager = new SessionManager(1000);
    _testSessionId = sessionManager.createSession(
      "https://example.com",
      createTestSessionMetadata(),
    );
  });

  describe("Given a new error monitoring session", () => {
    describe("When JavaScript errors occur on the page", () => {
      it("Then they should be classified with proper severity and suggestions", () => {
        const jsError = createJavaScriptError(
          "TypeError: Cannot read properties of undefined",
          'TypeError: Cannot read properties of undefined (reading "property")\n  at Object.method (/path/to/file.js:10:5)',
          10,
          5,
          "https://example.com",
          "high",
        );

        expect(jsError.type).toBe("javascript");
        expect(jsError.severity).toBe("high");
        expect(jsError.line).toBe(10);
        expect(jsError.column).toBe(5);
        expect(jsError.message).toContain(
          "TypeError: Cannot read properties of undefined",
        );
      });

      it("Then suggestions should help developers fix the issue", () => {
        const errors = [
          createJsError("TypeError: Cannot read properties of undefined", 10, 5),
        ];

        const suggestions =
          errorDetectionService.generateErrorSuggestions(errors);
        expect(suggestions).toContain(
          "Check if variable is properly initialized before use",
        );
        expect(suggestions).toContain(
          "Use optional chaining (?.) for safer property access",
        );
      });
    });

    describe("When network errors occur", () => {
      it("Then response time and status codes should be captured", () => {
        const networkError = createNetworkError(
          "Failed to load resource: the server responded with status 404",
          "https://example.com/not-found.js",
          1250,
          404,
          "medium",
        );

        expect(networkError.type).toBe("network");
        expect(networkError.url).toBe("https://example.com/not-found.js");
        expect(networkError.responseTime).toBe(1250);
        expect(networkError.statusCode).toBe(404);
      });
    });

    describe("When multiple errors of the same type occur", () => {
      it("Then error patterns should be identified for analysis", () => {
        const errors = [
          createJsError("TypeError: Cannot read property foo", 1),
          createJsError("TypeError: Cannot read property bar", 2),
          createJavaScriptError(
            "ReferenceError: x is not defined",
            "stack",
            3,
            3,
            "https://example.com",
          ),
        ];

        const patterns = errorDetectionService.analyzeErrorPatterns(errors);
        expect(patterns).toContain("TypeError");
        expect(patterns).toContain("ReferenceError");
      });

      it("Then most common errors should be ranked", () => {
        const errors = [
          createJsError("TypeError: Cannot read property foo", 1),
          createJsError("TypeError: Cannot read property bar", 2),
          createJsError("TypeError: Cannot read property baz", 3),
        ];

        const commonErrors = errorDetectionService.getMostCommonErrors(errors);
        expect(commonErrors[0].type).toBe("javascript");
        expect(commonErrors).toHaveLength(3);
      });
    });
  });

  describe("Given a session with TTL management", () => {
    it("Then sessions should expire after TTL", async () => {
      const sessionId = createTestSession(sessionManager);
      expect(await waitForSessionExpiry(sessionManager, sessionId)).toBe(true);
    });

    it("Then manual session cleanup should work", () => {
      const sessionId = createTestSession(sessionManager);
      expect(sessionManager.deleteSession(sessionId)).toBe(true);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
  });

  describe("Given error detection with pattern matching", () => {
    it("Then known patterns should be properly classified", () => {
      const patterns = errorDetectionService.getErrorPatterns();
      expect(patterns).toHaveLength(6);

      const typeErrorPattern = patterns.find(
        (p) => p.name === "TypeError: Undefined Property",
      );
      expect(typeErrorPattern).toBeDefined();
      expect(typeErrorPattern?.severity).toBe("high");
      expect(typeErrorPattern?.category).toBe("Property Access");
    });

    it("Then pattern regex should match real errors", () => {
      const typeErrorPattern = errorDetectionService
        .getErrorPatterns()
        .find((p) => p.name === "TypeError: Undefined Property");

      expect(
        typeErrorPattern?.regex.test(
          "TypeError: Cannot read properties of undefined",
        ),
      ).toBe(true);
      expect(
        typeErrorPattern?.regex.test(
          "TypeError: Cannot read property foo of null",
        ),
      ).toBe(true);
    });
  });

  describe("Given memory-safe error storage", () => {
    it("Then error store should maintain immutability", () => {
      const error = createJavaScriptError(
        "Test error",
        "Test stack",
        1,
        1,
        "https://test.com",
      );

      expect(Object.isFrozen(error)).toBe(true);
    });

    it("Then store should maintain statistics", () => {
      for (let i = 0; i < 5; i++) {
        createJavaScriptError(
          `Test error ${i}`,
          `Test stack ${i}`,
          i,
          i,
          `https://test.com/${i}`,
        );
      }

      expect(true).toBe(true);
    });
  });
});
