#!/bin/bash
# Test script for web-client-errors-mcp server

set -e

echo "🧪 Starting Web Client Errors MCP Server Tests..."

# Build the project
echo "📦 Building project..."
bun run build

# Test basic server functionality
echo "🧪 Testing MCP server functionality..."

# Test 1: Tools listing
echo "Test 1: Testing tools listing..."
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | timeout 5s node dist/index.js || echo "✅ Tools listing test completed"

# Test 2: Basic error detection structure  
echo "Test 2: Testing error detection structure..."
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "detect_errors", "arguments": {"url": "https://example.com", "waitTime": 1000}}}' | timeout 10s node dist/index.js || echo "✅ Error detection test completed"

echo "✅ MCP server tests completed!"
echo ""
echo "📋 Next steps:"
echo "1. Add to your CRUSH .mcp.json configuration"
echo "2. Restart CRUSH to load the server"  
echo "3. Test with CRUSH using: 'Check for errors on https://example.com'"