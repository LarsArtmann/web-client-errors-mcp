# Contributing to Web Client Errors MCP

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Quick Start

```bash
# Clone and setup
git clone https://github.com/LarsArtmann/web-client-errors-mcp.git
cd web-client-errors-mcp
bun install

# Development
bun run build    # Build TypeScript
bun run dev      # Watch mode
bun run test     # Run tests
bun run lint     # Lint code

# Full check
just check       # typecheck + lint + test
```

## Development Workflow

See [docs/BRANCHING-FLOW.md](docs/BRANCHING-FLOW.md) for detailed branching strategy.

### Quick Branch Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes and commit
git add .
git commit -m "feat(scope): description"

# 3. Keep main synced
git fetch origin
git rebase origin/main

# 4. Push and create PR
git push -u origin HEAD
gh pr create
```

## Commit Message Format

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code refactoring |
| `docs` | Documentation |
| `test` | Tests |
| `chore` | Maintenance |
| `perf` | Performance |
| `ci` | CI/CD |

### Examples

```
feat(browser-manager): add error deduplication
fix(session-store): resolve memory leak on timeout
docs(readme): update installation steps
test(mcp-server): add integration tests
```

## Code Style

- TypeScript strict mode enabled
- 2-space indentation
- Double quotes for strings
- Trailing commas in multiline
- ESLint + Prettier configured

### Run Formatters

```bash
bun run lint     # Check linting
bun run lint --fix  # Auto-fix issues
bun run format   # Format code
```

## Testing

### Run Tests

```bash
bun test         # Run all tests
bun test --watch # Watch mode
bun test --coverage # With coverage
```

### Write Tests

- Use Vitest for unit and integration tests
- Follow BDD style for readability
- Test behavior, not implementation
- Mock external dependencies

### Test Structure

```typescript
describe("Feature/Component", () => {
  describe("Given a condition", () => {
    describe("When action occurs", () => {
      it("Then expected result", () => {
        // Arrange
        const input = "test";

        // Act
        const result = process(input);

        // Assert
        expect(result).toBe("expected");
      });
    });
  });
});
```

## Project Structure

```
src/
├── core/           # MCP server implementation
├── services/       # Business logic (browser, error detection)
├── repositories/   # Data access (session store)
├── types/          # Domain types
├── utils/          # Utilities
├── config.ts       # Configuration
└── logger.ts       # Logging setup
```

## Pull Request Checklist

- [ ] Code follows project style
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Commit messages follow convention
- [ ] All CI checks pass
- [ ] PR description is clear

## Issue Reporting

### Bug Reports

```markdown
**Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., macOS]
- Node: [e.g., 20.0.0]
- Bun: [e.g., 1.0.0]
```

### Feature Requests

```markdown
**Problem/Use Case**
What problem does this solve?

**Proposed Solution**
How should it work?

**Alternatives Considered**
Other approaches tried?
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Questions? Open an issue for discussion before starting major changes.
