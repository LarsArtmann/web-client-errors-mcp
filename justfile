# Web Client Errors MCP - Justfile

# Default recipe
default: build test lint

# Development workflow
dev:
  bun run dev

# Build the project
build:
  bun run build

# Run tests
test:
  bun test

# Type checking
typecheck:
  bun run typecheck

# Linting
lint:
  bun run lint

# Fix linting issues
lint-fix:
  bun run lint --fix

# Start the MCP server
start:
  bun start

# Full quality check
check: typecheck lint test

# Install dependencies
install:
  bun install

# Clean build artifacts
clean:
  rm -rf dist/

# Full rebuild
rebuild: clean build

# Run server in development mode
dev-server:
  bun run dev &

# Production build check
prod-check: build typecheck lint test

# Format code
format:
  bun run format

# All quality fixes
fix: lint-fix format

# Quick start (install + build + test)
setup: install build test

# Continuous integration (all checks)
ci: build typecheck lint test

# Security audit
audit:
  bun audit

# Find code duplicates (alias: fd)
find-duplicates:
  bunx jscpd src --min-tokens 50 --format typescript --threshold 10 --ignore "**/*.test.ts,**/*.d.ts"

# Alias for find-duplicates
fd: find-duplicates

# Dependency update
update-deps:
  bun update

# Development watch mode
watch:
  bun run dev

# Test coverage
coverage:
  bun test --coverage

# Performance monitoring
perf:
  bun start --profile

# Help
help:
  @echo "Available commands:"
  @echo "  build        - Build TypeScript to JavaScript"
  @echo "  test         - Run test suite"
  @echo "  lint         - Run ESLint"
  @echo "  lint-fix     - Run ESLint with --fix"
  @echo "  typecheck    - Run TypeScript type checking"
  @echo "  start        - Start MCP server"
  @echo "  dev          - Run in development mode"
  @echo "  check        - Run typecheck, lint, and test"
  @echo "  clean        - Remove build artifacts"
  @echo "  rebuild      - Clean and rebuild"
  @echo "  format       - Format code with Prettier"
  @echo "  fix          - Fix linting and formatting issues"
  @echo "  setup        - Install deps + build + test"
  @echo "  ci           - Run all CI checks"
  @echo "  watch        - Run in watch mode"
  @echo "  coverage     - Run tests with coverage"
  @echo "  perf         - Start with performance monitoring"
  @echo "  audit        - Run security audit on dependencies"
  @echo "  update-deps  - Update all dependencies"
  @echo "  fd           - Find code duplicates (alias for find-duplicates)"
  @echo "  find-duplicates - Find code duplicates using jscpd"
  @echo "  help         - Show this help message"