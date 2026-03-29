# Branching Flow Strategy

## Overview

This document defines the branching and development workflow for the Web Client Errors MCP project.

## Branch Types

| Branch Pattern | Purpose | Lifespan | Example |
|----------------|---------|----------|---------|
| `main` | Production-ready code | Permanent | `main` |
| `feature/*` | New features | Until merged | `feature/session-persistence` |
| `fix/*` | Bug fixes | Until merged | `fix/browser-crash-on-timeout` |
| `refactor/*` | Code improvements | Until merged | `refactor/error-types` |
| `docs/*` | Documentation updates | Until merged | `docs/api-reference` |
| `chore/*` | Maintenance tasks | Until merged | `chore/update-deps` |
| `hotfix/*` | Production emergency fixes | Until merged | `hotfix/critical-memory-leak` |

## Workflow

### 1. Feature Development

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/my-new-feature

# Work on feature...
git add .
git commit -m "feat(feature-name): description"

# Keep main in sync
git fetch origin
git rebase origin/main

# Push and create PR
git push -u origin feature/my-new-feature
gh pr create --title "feat: My New Feature" --body "## Summary\n- New feature implementation"
```

### 2. Bug Fixes

```bash
# Create fix branch from main
git checkout main
git pull origin main
git checkout -b fix/issue-description

# Work on fix...
git add .
git commit -m "fix: resolved issue description"

# Push and create PR
git push -u origin fix/issue-description
gh pr create --title "fix: Issue Description" --body "## Summary\n- Root cause identified\n- Fix applied\n- Test added"
```

### 3. Hotfixes (Production Emergencies)

```bash
# Create hotfix from main
git checkout main
git checkout -b hotfix/critical-issue

# Apply fix immediately
git add .
git commit -m "hotfix: critical issue description"

# Fast-track review and merge
gh pr create --title "hotfix: Critical Issue" --body "## Summary\n- Emergency fix\n- Requires immediate review"
```

## Commit Message Convention

Format: `<type>(<scope>): <description>`

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code refactoring |
| `docs` | Documentation changes |
| `style` | Formatting, no code change |
| `test` | Adding/updating tests |
| `chore` | Maintenance, dependencies |
| `perf` | Performance improvement |
| `ci` | CI/CD changes |

### Examples

```
feat(browser-manager): add network error tracking
fix(session-store): resolve memory leak on cleanup
refactor(error-detection): simplify pattern matching
docs(readme): update installation instructions
test(mcp-server): add integration tests
chore(deps): update playwright to v1.58
```

## Pull Request Process

### PR Requirements

- [ ] Descriptive title following commit convention
- [ ] Summary of changes
- [ ] Test plan included
- [ ] All CI checks passing
- [ ] No merge conflicts with main
- [ ] At least one review approval (for non-hotfixes)

### PR Labels

| Label | Purpose |
|-------|---------|
| `breaking` | Contains breaking changes |
| `feature` | New feature |
| `bugfix` | Bug fix |
| `documentation` | Docs only |
| `dependencies` | Dependency updates |
| `refactoring` | Code improvement |
| `hotfix` | Production emergency |
| `needs-review` | Awaiting review |

## CI/CD Pipeline

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for the complete pipeline.

### Pipeline Stages

1. **Lint** - ESLint + Prettier check
2. **Type Check** - TypeScript compilation
3. **Test** - Unit and integration tests
4. **Build** - Production build

## Release Process

### Version Strategy

- Follows [Semantic Versioning](https://semver.org/)
- Format: `MAJOR.MINOR.PATCH`
- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes (backward compatible)

### Release Steps

```bash
# 1. Update version
npm version patch  # or minor/major

# 2. Create release commit
git tag -a v1.0.0 -m "Release v1.0.0"

# 3. Push with tags
git push origin main --tags
```

## Quick Reference

| Action | Command |
|--------|---------|
| Start new feature | `git checkout -b feature/name` |
| Keep updated | `git rebase origin/main` |
| Commit changes | `git commit -m "type: description"` |
| Push branch | `git push -u origin HEAD` |
| Create PR | `gh pr create` |
| Update PR | `git push origin HEAD` |
| Merge PR | `gh pr merge --squash` |

---

_Generated for web-client-errors-mcp project_
