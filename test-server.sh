#!/bin/bash
# Test script for web-client-errors-mcp server

set -e

echo "🧪 Starting Web Client Errors MCP Server Tests..."

# Build the project
echo "📦 Building project..."
npm run build

# Start server in background for testing
echo "🚀 Starting MCP server for testing..."
node dist/index.js &
SERVER_PID=$!

# Give server time to start
sleep 2

# Test basic server functionality
echo "🧪 Testing MCP server functionality..."

# Test 1: Tools listing
echo "Test 1: Testing tools listing..."
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node dist/index.js &
sleep 1

# Test 2: Basic error detection (if we had a test URL)
echo "Test 2: Testing error detection structure..."
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "detect_errors", "arguments": {"url": "https://example.com", "waitTime": 1000}}}' | node dist/index.js &
sleep 1

# Cleanup
echo "🧹 Cleaning up test server..."
kill $SERVER_PID 2>/dev/null || true

echo "✅ MCP server tests completed!"
echo ""
echo "📋 Next steps:"
echo "1. Add to your CRUSH .mcp.json configuration"
echo "2. Restart CRUSH to load the server"  
echo "3. Test with CRUSH using: 'Check for errors on https://example.com'"