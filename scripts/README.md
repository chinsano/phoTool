# phoTool Scripts

Helper scripts for development and quality assurance.

---

## Pre-Commit Check

**File**: `pre-commit-check.sh`

### Purpose
Runs the complete pre-commit checklist from `docs/Rules.md` to ensure all quality gates pass before committing code changes.

### Usage

```bash
# Run from project root
./scripts/pre-commit-check.sh
```

### What It Checks

1. **Lint** - Repo-wide linting with zero warnings (`npm run lint:ci`)
2. **Dependency Boundaries** - Ensures no circular dependencies (`npm run depcruise`)
3. **Type Safety** - TypeScript type checking (`npm run type-check`)
4. **Dependencies** - Server workspace installation
5. **Shared Build** - Builds shared package
6. **Tests** - Full test suite including:
   - Unit tests
   - Integration tests (`shared.integration.test.ts`)
   - Error simulation tests (`shared.error-simulation.test.ts`)
   - Performance tests (`shared.performance.test.ts`)
7. **Cleanup** - Removes temporary test directories (`server/tmp-*`)
8. **DB Migrations** - Verifies migrations if schema changed
9. **Plan Updates** - Ensures `docs/phoTool.plan.md` is updated when required
10. **Console Calls** - Checks for inappropriate console.* usage
11. **ADRs** - Verifies ADR updates if present

### Exit Codes

- **0** - All checks passed, safe to commit
- **1** - One or more checks failed, fix issues before committing

### Output

The script provides color-coded output:
- 🟢 **Green** - Check passed
- 🔴 **Red** - Check failed
- 🟡 **Yellow** - Warning or requires manual verification

### Example

```bash
$ ./scripts/pre-commit-check.sh

========================================
🔍 Pre-Commit Checklist
========================================

1️⃣  Checking lint (zero warnings)...
[lint:ci] ✅ PASS

2️⃣  Checking dependency boundaries...
[depcruise] ✅ PASS

3️⃣  Type checking...
[type-check] ✅ PASS

# ... (more checks)

========================================
✅ ALL CHECKS PASSED
========================================

You can now commit your changes:
  git commit -m "your message"
```

### Integration with Git Hooks

This script is separate from the automated git hooks but provides a convenient way to run all checks manually before committing. 

The automated pre-commit hook (via Husky) runs a subset of these checks. This script provides the complete checklist.

### When to Run

**Required**:
- Before committing any workpackage
- After completing acceptance criteria for a workpackage
- Before creating a PR

**Recommended**:
- Periodically during development to catch issues early
- After resolving merge conflicts
- When switching between workpackages

### Troubleshooting

**Script fails on first check?**
- Ensure you're in the project root directory
- Ensure all dependencies are installed: `npm install`

**Tests fail?**
- Run tests individually to identify the issue
- Check test output for specific failures
- Ensure database migrations are up to date

**Plan update required?**
- If you modified files in `packages/shared/`, `server/src/`, `server/drizzle/`, or `docs/adr/`
- Update `docs/phoTool.plan.md` to mark TODOs complete
- Stage the plan update: `git add docs/phoTool.plan.md`

---

## Future Scripts

Additional scripts will be added here as needed:
- `seed.ts` - Database seeding (WP-5.2)
- `validate-api.sh` - API contract validation
- `benchmark.sh` - Performance benchmarking

---

## Contributing

When adding new scripts:
1. Make them executable: `chmod +x scripts/your-script.sh`
2. Add documentation to this README
3. Follow the project's coding standards
4. Include error handling and clear output
