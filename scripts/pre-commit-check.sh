#!/bin/bash
# Pre-Commit Checklist Script
# Run this before every commit to ensure all quality gates pass
# Based on Rules.md pre-commit checklist

set -e  # Exit on first error

echo "========================================"
echo "🔍 Pre-Commit Checklist"
echo "========================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

run_check() {
    local name="$1"
    local cmd="$2"
    
    echo -n "[$name] "
    if eval "$cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "  Command: $cmd"
        FAILED=1
        return 1
    fi
}

# 1. Repo-wide lint (zero warnings)
echo "1️⃣  Checking lint (zero warnings)..."
run_check "lint:ci" "npm run lint:ci"
echo ""

# 2. Dependency boundaries
echo "2️⃣  Checking dependency boundaries..."
run_check "depcruise" "npm run depcruise"
echo ""

# 3. Type checking
echo "3️⃣  Type checking..."
run_check "type-check" "npm run type-check"
echo ""

# 4. Server workspace install
echo "4️⃣  Installing server dependencies..."
run_check "server install" "npm --workspace @phoTool/server install --no-audit --no-fund"
echo ""

# 5. Shared package build
echo "5️⃣  Building shared package..."
run_check "shared build" "npm --workspace @phoTool/shared run build"
echo ""

# 6. Run tests
echo "6️⃣  Running test suite..."
echo "   This may take a while..."
if npm run server:test; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
    FAILED=1
fi
echo ""

# 7. Clean up temporary test directories
echo "7️⃣  Cleaning temporary test directories..."
if ls server/tmp-* > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Found temporary test directories${NC}"
    echo "   Cleaning: server/tmp-*"
    rm -rf server/tmp-*
    echo -e "${GREEN}✅ CLEANED${NC}"
else
    echo -e "${GREEN}✅ No temp directories found${NC}"
fi
echo ""

# 8. Check if DB schema changed
echo "8️⃣  Checking DB schema changes..."
if git diff --cached --name-only | grep -q "server/src/db/schema/"; then
    echo -e "${YELLOW}⚠️  DB schema files modified${NC}"
    echo "   Have you run:"
    echo "   - npm --workspace @phoTool/server run db:generate"
    echo "   - npm --workspace @phoTool/server run db:migrate"
    echo ""
    read -p "   Migrations up to date? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ Please update migrations${NC}"
        FAILED=1
    else
        echo -e "${GREEN}✅ Migrations confirmed${NC}"
    fi
else
    echo -e "${GREEN}✅ No schema changes${NC}"
fi
echo ""

# 9. Check for plan updates
echo "9️⃣  Checking plan updates..."
REQUIRES_PLAN_UPDATE=0
if git diff --cached --name-only | grep -qE "^(packages/shared/|server/src/|server/drizzle/|docs/adr/)"; then
    REQUIRES_PLAN_UPDATE=1
    if git diff --cached --name-only | grep -q "docs/phoTool.plan.md"; then
        echo -e "${GREEN}✅ Plan update staged${NC}"
    else
        echo -e "${RED}❌ Plan update REQUIRED but not staged${NC}"
        echo "   Modified files in: packages/shared/, server/src/, server/drizzle/, or docs/adr/"
        echo "   You must update docs/phoTool.plan.md"
        FAILED=1
    fi
else
    echo -e "${GREEN}✅ No plan update required${NC}"
fi
echo ""

# 10. Check for console.* in production code
echo "🔟 Checking for console.* in production code..."
if grep -r "console\." server/src/ --exclude-dir=node_modules 2>/dev/null | grep -v "console.warn\|console.error" | grep -q .; then
    echo -e "${RED}❌ Found console.* calls (only console.warn and console.error allowed)${NC}"
    grep -r "console\." server/src/ --exclude-dir=node_modules | grep -v "console.warn\|console.error"
    FAILED=1
else
    echo -e "${GREEN}✅ No inappropriate console calls${NC}"
fi
echo ""

# 11. Check ADRs
echo "1️⃣1️⃣  Checking ADR updates..."
if git diff --cached --name-only | grep -q "docs/adr/"; then
    echo -e "${YELLOW}⚠️  ADR files modified${NC}"
    echo "   Modified ADRs:"
    git diff --cached --name-only | grep "docs/adr/"
    echo -e "${GREEN}✅ ADRs updated${NC}"
else
    echo -e "${GREEN}✅ No ADR changes${NC}"
fi
echo ""

# Summary
echo "========================================"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED${NC}"
    echo "========================================"
    echo ""
    echo "You can now commit your changes:"
    echo "  git commit -m \"your message\""
    exit 0
else
    echo -e "${RED}❌ SOME CHECKS FAILED${NC}"
    echo "========================================"
    echo ""
    echo "Please fix the issues above before committing."
    exit 1
fi
