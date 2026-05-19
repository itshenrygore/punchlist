#!/bin/bash
# ================================================================
# PUNCHLIST — Pre-Deploy Gate
# Version: v61
#
# Runs the full smoke test suite, then confirms deploy readiness.
# Usage: bash scripts/pre-deploy.sh
#
# This is the ONLY script you need to run before deploying.
# It runs the smoke test (which includes a production build).
# ================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}  PUNCHLIST PRE-DEPLOY CHECK — v61${NC}"
echo -e "${BOLD}═══════════════════════════════════════════${NC}"
echo ""

# ── Step 1: Run the smoke test ──
echo -e "${BOLD}Running smoke tests...${NC}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/smoke-test.sh"
SMOKE_EXIT=$?

echo ""

# ── Step 2: Report result ──
if [ "$SMOKE_EXIT" -eq 0 ]; then
  echo -e "${BOLD}═══════════════════════════════════════════${NC}"
  echo -e "  ${GREEN}${BOLD}✓ READY FOR DEPLOY${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════${NC}"
  echo ""
  echo "  Next steps:"
  echo "    1. git add -A && git commit -m 'v61 Phase 6: test harness'"
  echo "    2. git push origin main"
  echo "    3. Deploy via Vercel dashboard (drag-and-drop or auto)"
  echo ""
  echo "  Post-deploy verification:"
  echo "    [ ] https://punchlist.ca loads (landing page)"
  echo "    [ ] /login and /signup routes work"
  echo "    [ ] Create a test quote end-to-end"
  echo "    [ ] View a public quote link"
  echo "    [ ] View a public invoice link"
  echo "    [ ] Calendar shows existing bookings"
  echo "    [ ] No console errors on any page"
  echo ""
  exit 0
else
  echo -e "${BOLD}═══════════════════════════════════════════${NC}"
  echo -e "  ${RED}${BOLD}✗ FIX ISSUES BEFORE DEPLOY${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════${NC}"
  echo ""
  echo "  Review the FAIL items above and fix before deploying."
  echo ""
  exit 1
fi
