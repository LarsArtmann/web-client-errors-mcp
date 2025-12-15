# CRUSH Integration

> Do one thing well: Detect client-side web errors in CRUSH

This MCP server does exactly one thing: finds client-side errors on websites for CRUSH to analyze.

## 🔧 Configuration

**File**: `/Users/larsartmann/.config/crush/crush.json`

**Added**:

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

## 🚀 Use with CRUSH

### Restart CRUSH

Exit and restart CRUSH to load the new MCP server.

### Available Tools

- **detect_errors** - Find errors on any website
- **analyze_error_session** - Analyze error patterns
- **get_error_details** - Investigate specific errors

### Basic Usage

```
"detect errors on https://example.com"
"analyze error session from previous detection"
"get details for TypeError we just found"
```

## ✅ Status

All verification tests passed. Server is ready for use.

Restart CRUSH to start detecting client-side web errors.
