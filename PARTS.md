# PARTS.md — Reusable Component Analysis

> Analysis of components that could be extracted as standalone reusable libraries/SDKs

**Project:** web-client-errors-mcp
**Analyzed:** 2026-03-03
**Version:** 1.0.0

---

## Executive Summary

This MCP server is intentionally focused on a single purpose (UNIX philosophy). However, several internal components have reusability potential if extracted carefully. **Two components stand out as strong library candidates:**

| Component | Recommendation | Rationale |
|-----------|----------------|-----------|
| **Web Error Domain Types** | **EXTRACT** | Branded types, discriminated unions, and immutable data patterns are broadly applicable |
| **Error Pattern Detection** | **EXTRACT** | Intelligent error classification with actionable suggestions has value beyond MCP |

The remaining components are either too tightly coupled to MCP/Playwright or have mature alternatives that diminish extraction value.

---

## Component Analysis

### 1. Web Error Domain Types (`src/types/domain.ts`)

**Purpose:** Branded types, discriminated unions, and immutable domain models for web error handling.

#### What It Provides

```
Branded Types:
- ISO8601String (validated timestamp strings)
- SessionId (unique session identifiers)
- ErrorId (unique error identifiers)
- NonEmptyString (non-empty string guard)

Discriminated Unions:
- WebError = JavaScriptError | NetworkError | ResourceError | ConsoleError | PerformanceError | SecurityError
- ErrorSeverity = "low" | "medium" | "high" | "critical"
- ErrorType = "javascript" | "network" | "resource" | "console" | "performance" | "security"

Immutable Factories:
- createJavaScriptError()
- createNetworkError()
- createErrorSession()

Session Management:
- SessionManager (TTL-based cleanup, immutable updates)
- ErrorStore (frozen error storage)
```

#### Reusability Score: **HIGH** (8/10)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Domain independence | 9/10 | Zero external dependencies beyond TypeScript |
| Clear API boundary | 9/10 | Pure functions, immutable data |
| Testability | 10/10 | 100% unit testable |
| Documentation potential | 8/10 | Self-documenting types |
| Community demand | 6/10 | Niche but valuable |

#### Existing Alternatives

| Library | What It Provides | Gap Analysis |
|---------|------------------|--------------|
| **Effect Schema** | Branded types, runtime validation, parse errors | Full framework dependency; overkill for simple use cases |
| **io-ts** | Runtime type validation with branded types | FP-heavy; steeper learning curve |
| **zod** | Schema validation with `.brand()` | No domain-specific web error types |
| **TypeBox** | JSON Schema + TypeScript types | No branded type support |

#### Unique Value Proposition

**Our abstraction provides:**

1. **Web-specific domain model** — Pre-built discriminated unions for JavaScript, network, resource, console, performance, and security errors
2. **Zero dependencies** — Pure TypeScript, no runtime overhead
3. **Immutability by default** — `Object.freeze()` on all created entities
4. **Type guards included** — `isISO8601()`, `toNonEmptyString()`, etc.
5. **Session lifecycle** — TTL-based cleanup, memory-safe patterns

**Proposed Library Name:** `@larsartmann/web-error-types`

**Target Users:**
- Error monitoring SDK developers
- Testing frameworks needing error simulation
- MCP servers handling web errors
- Browser automation tools

---

### 2. Error Pattern Detection (`src/services/error-detection.ts`)

**Purpose:** Intelligent classification of web errors with pattern matching and actionable suggestions.

#### What It Provides

```
Pattern Definitions:
- TypeError: Undefined Property → Property Access category
- ReferenceError: Not Defined → Variable Reference category
- Network Error / CORS → Network category
- Promise Rejection → Async Handling category
- 404 / 500 → Resource/Server categories

Capabilities:
- classifyError() — Pattern matching with severity inference
- analyzeErrorPatterns() — Extract common error patterns from batch
- getMostCommonErrors() — Frequency analysis
- generateErrorSuggestions() — Actionable fix recommendations
```

#### Reusability Score: **HIGH** (7/10)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Domain independence | 8/10 | Only depends on domain types |
| Clear API boundary | 8/10 | Pure functions |
| Testability | 9/10 | Pattern matching is easily tested |
| Documentation potential | 7/10 | Pattern catalog needs docs |
| Community demand | 6/10 | Useful for error dashboards |

#### Existing Alternatives

| Library | What It Provides | Gap Analysis |
|---------|------------------|--------------|
| **Sentry SDK** | Error capture, breadcrumbs, stack trace parsing | Full monitoring platform; requires backend |
| **Rollbar** | Error grouping, deduplication | Commercial service; not a library |
| **stacktrace.js** | Stack trace parsing | No classification or suggestions |
| **error-stack-parser** | Stack frame extraction | No semantic analysis |

#### Unique Value Proposition

**Our abstraction provides:**

1. **Actionable suggestions** — Each pattern includes 2-3 specific fix recommendations
2. **Severity inference** — Automatic severity classification from error message
3. **Category taxonomy** — Property Access, Variable Reference, Network, Async, Resource, Server
4. **Zero runtime dependencies** — Pure pattern matching
5. **AI-friendly output** — Structured suggestions perfect for LLM consumption

**Proposed Library Name:** `@larsartmann/web-error-patterns`

**Target Users:**
- AI coding assistants (MCP servers, IDE extensions)
- Error monitoring dashboards
- Automated debugging tools
- CI/CD error analysis pipelines

---

### 3. Browser Manager (`src/services/browser-manager.ts`)

**Purpose:** Playwright browser lifecycle and error listener orchestration.

#### What It Provides

```
Lifecycle:
- initializeBrowser() — Chromium launch with config
- createContext() — Isolated browser context
- createPageWithContext() — Page with error listeners

Error Listeners:
- pageerror → JavaScript errors
- console → Console warnings/errors
- response → HTTP 4xx/5xx detection
- requestfailed → Network failure detection
```

#### Reusability Score: **LOW** (3/10)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Domain independence | 3/10 | Tightly coupled to Playwright |
| Clear API boundary | 5/10 | Mixed concerns (lifecycle + listeners) |
| Testability | 4/10 | Requires browser automation |
| Documentation potential | 5/10 | Playwright-specific |
| Community demand | 4/10 | Many alternatives exist |

#### Existing Alternatives

| Library | What It Provides | Gap Analysis |
|---------|------------------|--------------|
| **Playwright** | Native `page.on('pageerror')`, `page.on('console')` | Built-in; no abstraction needed |
| **Puppeteer** | Same pattern with different API | Already native |
| **@axe-core/playwright** | Accessibility testing + Playwright | Different domain |

#### Recommendation: **DO NOT EXTRACT**

**Rationale:**
- Playwright already provides native error event handling
- The abstraction adds minimal value over `page.on('pageerror', ...)`
- Tight coupling to specific Playwright version
- Better to document patterns than create a library

---

### 4. MCP Server Framework (`src/core/mcp-server.ts`)

**Purpose:** MCP protocol implementation with tool/resource handlers.

#### What It Provides

```
Tools:
- detect_errors — Navigate URL, collect errors
- analyze_error_session — Pattern analysis
- get_error_details — Deep dive on specific error

Resources:
- errors://recent — Last 100 errors
- errors://stats — Aggregated statistics

Patterns:
- Zod validation schemas
- Graceful shutdown handling
- Error response formatting
```

#### Reusability Score: **LOW** (2/10)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Domain independence | 1/10 | MCP-specific |
| Clear API boundary | 4/10 | Handlers are domain-specific |
| Testability | 5/10 | MCP protocol mocking needed |
| Documentation potential | 3/10 | Use official SDK docs |
| Community demand | 2/10 | Official SDK covers needs |

#### Existing Alternatives

| Library | What It Provides | Gap Analysis |
|---------|------------------|--------------|
| **@modelcontextprotocol/sdk** | Official TypeScript SDK | Comprehensive; well-documented |
| **MCP Python SDK** | Python implementation | Different language |
| **fastmcp** | High-level Python wrapper | Different language |

#### Recommendation: **DO NOT EXTRACT**

**Rationale:**
- Official SDK already provides excellent patterns
- Server implementation is domain-specific (web errors)
- No generic abstraction value
- Better to contribute examples to official SDK

---

### 5. Structured Logging (`src/logger.ts`)

**Purpose:** LogTape integration with sensitive data redaction.

#### What It Provides

```
Features:
- initializeLogging() — LogTape configuration
- getAppLogger() — Category-scoped logger
- redactSensitiveData() — Recursive redaction of passwords, tokens, etc.

Sensitive Fields:
- password, token, secret, key, auth, authorization, cookie, session, csrf
```

#### Reusability Score: **MEDIUM** (5/10)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Domain independence | 7/10 | Generic logging utility |
| Clear API boundary | 6/10 | Tied to LogTape |
| Testability | 8/10 | Pure redaction function |
| Documentation potential | 5/10 | Simple utility |
| Community demand | 4/10 | Many logging solutions |

#### Existing Alternatives

| Library | What It Provides | Gap Analysis |
|---------|------------------|--------------|
| **pino** | Fast JSON logging with redaction | Built-in redaction feature |
| **winston** | Multiple transports | Plugin for redaction |
| **signale** | Pretty logging | No built-in redaction |
| **LogTape** | Category-based logging | Used in this project |

#### Recommendation: **CONSIDER MINI-EXTRACTION**

**Rationale:**
- The `redactSensitiveData()` function is independently useful
- Could be published as `@larsartmann/log-redact`
- Small enough to be a single-file utility
- Better alternatives exist (pino's redaction)

---

### 6. Configuration (`src/config.ts`)

**Purpose:** Server configuration with validation.

#### What It Provides

```
Structure:
- browser: { headless, viewport, userAgent, args }
- thresholds: { slowResponse, sessionTimeout, maxErrors }
- logging: { level, structured, redactSensitiveData }
- features: { domSnapshots, performanceMetrics, errorDeduplication, sentryIntegration }
- sentry?: { dsn, environment, tracesSampleRate }

Functions:
- getConfig() / setConfig()
- validateConfig()
```

#### Reusability Score: **LOW** (2/10)

| Criterion | Score | Notes |
|-----------|-------|-------|
| Domain independence | 2/10 | Web-error-specific |
| Clear API boundary | 5/10 | Simple getter/setter |
| Testability | 6/10 | Basic validation |
| Documentation potential | 2/10 | Domain-specific |
| Community demand | 1/10 | Use koanf/c12/etc |

#### Existing Alternatives

| Library | What It Provides | Gap Analysis |
|---------|------------------|--------------|
| **c12** | Universal config with defaults, env, overrides | More features |
| **unconfig** | Smart config loading | Auto-detection |
| **conf** | Simple config with defaults | Electron-focused |

#### Recommendation: **DO NOT EXTRACT**

**Rationale:**
- Too domain-specific
- Many superior alternatives exist
- Configuration is inherently project-specific

---

## Extraction Priority Matrix

```
                    High Reusability
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    EXTRACT          EXTRACT         CONSIDER
  Web Error      Error Pattern      Log Redact
    Types         Detection          (mini)
         │               │               │
         └───────────────┼───────────────┘
                         │
                    Low Reusability
```

| Priority | Component | Action | Effort | Impact |
|----------|-----------|--------|--------|--------|
| **1** | Web Error Domain Types | Extract to `@larsartmann/web-error-types` | Medium | High |
| **2** | Error Pattern Detection | Extract to `@larsartmann/web-error-patterns` | Medium | Medium-High |
| **3** | Log Redaction | Extract to `@larsartmann/log-redact` | Low | Low |
| **—** | Browser Manager | Keep internal | — | — |
| **—** | MCP Server | Keep internal | — | — |
| **—** | Configuration | Keep internal | — | — |

---

## Implementation Roadmap

### Phase 1: Web Error Types Library

**Repository:** `github.com/LarsArtmann/web-error-types`

```
web-error-types/
├── src/
│   ├── branded.ts        # ISO8601String, SessionId, ErrorId, NonEmptyString
│   ├── errors.ts         # WebError discriminated union + factories
│   ├── session.ts        # SessionManager, ErrorStore
│   ├── guards.ts         # Type guards
│   └── index.ts          # Public exports
├── tests/
│   ├── branded.test.ts
│   ├── errors.test.ts
│   └── session.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Dependencies:** None (zero runtime deps)

### Phase 2: Error Pattern Detection Library

**Repository:** `github.com/LarsArtmann/web-error-patterns`

```
web-error-patterns/
├── src/
│   ├── patterns.ts       # ERROR_PATTERNS definition
│   ├── classify.ts       # classifyError()
│   ├── analyze.ts        # analyzeErrorPatterns(), getMostCommonErrors()
│   ├── suggest.ts        # generateErrorSuggestions()
│   └── index.ts
├── tests/
├── package.json          # Peer dep: web-error-types
└── README.md
```

**Dependencies:** `@larsartmann/web-error-types` (peer)

---

## Anti-Patterns to Avoid

When extracting these libraries:

1. **Don't over-abstract** — Keep domain-specific semantics
2. **Don't add framework dependencies** — Zero runtime deps is a feature
3. **Don't duplicate Effect/Zod** — Focus on web error domain, not validation
4. **Don't create config hell** — Sensible defaults, minimal configuration
5. **Don't break MCP integration** — This project remains the primary consumer

---

## Success Metrics

For extracted libraries:

| Metric | Target |
|--------|--------|
| Bundle size | < 5KB gzipped |
| Dependencies | 0 runtime |
| Test coverage | > 95% |
| Type coverage | 100% |
| Download time (first install) | < 1 second |

---

## Conclusion

**Extract:** Web Error Types + Error Pattern Detection
**Keep Internal:** Browser Manager, MCP Server, Configuration, Logging (except redaction)

The two extraction candidates share a common philosophy: **pure TypeScript, zero dependencies, immutable data, and web-specific domain modeling**. These libraries would benefit not just this project but any TypeScript application dealing with web error handling.

The key differentiator from alternatives like Effect Schema or Sentry is **domain specificity** — we're not building a general-purpose validation library or monitoring platform, but a focused toolkit for web error modeling and intelligent analysis.
