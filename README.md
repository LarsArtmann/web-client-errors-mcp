# Web Client Errors MCP

> Detect client-side JavaScript and network errors on any website — built for AI coding agents.

[![npm version](https://img.shields.io/npm/v/web-client-errors-mcp.svg)](https://www.npmjs.com/package/web-client-errors-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)

## What It Does

**Web Client Errors MCP** is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that detects and analyzes client-side errors on websites. It uses Playwright to launch a real browser, navigate to any URL, and capture:

- **JavaScript errors** — Uncaught exceptions, reference errors, type errors
- **Network errors** — Failed requests, CORS issues, 4xx/5xx responses
- **Console warnings** — Potentially problematic console output
- **Resource loading failures** — Missing assets, failed fetches

Designed specifically for AI coding agents (like [CRUSH](https://github.com/crush)) to help debug web applications effectively.

## Why This Exists

When building or debugging web applications, client-side errors are notoriously difficult to catch — they happen in users' browsers, not in your terminal. This tool gives AI agents the ability to:

- Instantly detect errors on any website
- Get detailed error information with stack traces
- Analyze error patterns and get fix suggestions
- Debug production issues without manual browser testing

## 🎯 UNIX Philosophy

This project follows the UNIX philosophy:

- **Do one thing**: Detect client-side web errors
- **Do it well**: Reliable, accurate, comprehensive detection
- **Work together**: Integrates seamlessly with CRUSH
- **Handle text**: Natural language interface through CRUSH
- **Adapt**: Works on any website, any framework

## 📋 Quick Start with CRUSH

### Install and Configure

```bash
git clone https://github.com/LarsArtmann/web-client-errors-mcp.git
cd web-client-errors-mcp
bun install
bun run build
```

Add to your CRUSH `.mcp.json`:

```json
{
  "mcp": {
    "web-client-errors": {
      "type": "stdio",
      "command": "bun",
      "args": ["/path/to/web-client-errors-mcp/dist/core/mcp-server.js"],
      "disabled": false
    }
  }
}
```

### Use with CRUSH

```bash
# Restart CRUSH, then:
"detect errors on https://example.com"
"analyze error session from previous detection"
```

## 🛠️ Tools

### detect_errors

Detects client-side errors on any website using Playwright browser automation.

**Parameters**:

| Parameter                | Type    | Required | Description                                          |
| ------------------------ | ------- | -------- | ---------------------------------------------------- |
| `url`                    | string  | Yes      | Website URL to scan                                  |
| `waitTime`               | number  | No       | Milliseconds to wait for errors (default: 5000)      |
| `captureScreenshot`      | boolean | No       | Take screenshot (default: true)                      |
| `includeNetworkErrors`   | boolean | No       | Include network errors (default: true)               |
| `includeConsoleWarnings` | boolean | No       | Include console warnings (default: true)             |
| `interactWithPage`       | boolean | No       | Scroll/click to trigger lazy errors (default: false) |

**Example**: `"detect errors on https://mysite.com with 10 second wait"`

### analyze_error_session

Analyzes collected errors to find patterns and provide fix suggestions.

**Parameters**:

| Parameter            | Type    | Required | Description                                   |
| -------------------- | ------- | -------- | --------------------------------------------- |
| `sessionId`          | string  | Yes      | ID from error detection                       |
| `includeSuggestions` | boolean | No       | Include AI fix suggestions (default: true)    |
| `severity`           | string  | No       | Filter: error/warning/info/all (default: all) |

**Example**: `"analyze error session abc-123"`

### get_error_details

Gets detailed information about a specific error including stack trace and context.

**Parameters**:

| Parameter           | Type    | Required | Description                                        |
| ------------------- | ------- | -------- | -------------------------------------------------- |
| `errorId`           | string  | Yes      | Error message or ID to investigate                 |
| `includeStackTrace` | boolean | No       | Include full stack trace (default: true)           |
| `includeContext`    | boolean | No       | Include error context and analysis (default: true) |

**Example**: `"get details for TypeError undefined property"`

## 🔧 Development

```bash
bun install       # Install dependencies
bun run build     # Compile TypeScript
bun run dev       # Watch and rebuild
bun run typecheck # Type checking
bun test          # Run tests
bun run lint      # Lint code

# Or use just
just build        # Build project
just test         # Run tests
just check        # Full quality check
just ci           # CI pipeline
```

## 📁 Project Structure

```
src/
├── core/
│   └── mcp-server.ts      # MCP server implementation
├── services/
│   ├── browser-manager.ts # Playwright browser automation
│   └── error-detection.ts # Error classification & analysis
├── repositories/
│   └── session-store.ts   # Session & error storage
├── types/
│   └── domain.ts          # Domain types (branded, discriminated)
├── config.ts              # Configuration management
└── logger.ts              # Structured logging setup
```

## 🔌 Resources

The MCP server exposes these resources for AI agents:

- `errors://recent` — Most recent errors from all sessions
- `errors://stats` — Aggregated error statistics

## 📖 Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Coding      │────▶│  MCP Server      │────▶│  Playwright     │
│  Agent (CRUSH)  │     │  (This Project)  │     │  Browser        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                         ┌──────────────────┐
                         │  Session Store   │
                         │  Error Analysis  │
                         └──────────────────┘
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contribution guidelines |
| [docs/BRANCHING-FLOW.md](docs/BRANCHING-FLOW.md) | Branching strategy |

## 📄 License

MIT
