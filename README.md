# Web Client Errors MCP

> Do one thing well: Detect client-side web errors

A Model Context Protocol (MCP) server that does exactly one thing: finds client-side errors on websites so AI coding agents can debug them effectively.

## 🎯 UNIX Philosophy

This project follows UNIX principles:

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
      "command": "/Users/larsartmann/.bun/bin/bun",
      "args": ["run", "/path/to/web-client-errors-mcp/dist/index.js"],
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

Detects client-side errors on any website.

**Parameters**:

- `url` (required): Website to scan
- `waitTime` (optional): Milliseconds to wait for errors (default: 5000)
- `captureScreenshot` (optional): Take screenshot (default: true)

**Example**: `"detect errors on https://mysite.com with 10 second wait"`

### analyze_error_session

Analyzes collected errors to find patterns.

**Parameters**:

- `sessionId` (required): ID from error detection
- `severity` (optional): Filter by error/warning/info (default: all)

**Example**: `"analyze error session abc-123"`

### get_error_details

Gets detailed information about a specific error.

**Parameters**:

- `errorId` (required): Error message or ID to investigate
- `includeStackTrace` (optional): Include full stack trace (default: true)

**Example**: `"get details for TypeError undefined property"`

## 🔧 Development

```bash
bun run build     # Compile TypeScript
bun run dev        # Watch and rebuild
bun run typecheck  # Type checking
bun run test       # Run tests
```

## 📖 Philosophy

This project follows UNIX philosophy:

- **Do one thing**: Detect client-side web errors
- **Do it well**: Reliable, accurate, comprehensive detection
- **Work together**: Integrates seamlessly with CRUSH
- **Handle text**: Natural language interface through CRUSH
- **Adapt**: Works on any website, any framework

## 📄 License

MIT
