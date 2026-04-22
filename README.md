#!/bin/bash
# ================================================================
# PUNCHLIST — Smoke Test Suite
# Version: v100-M7
#
# Catches the most common regressions without a full test framework.
# Run before every deploy: bash deploy-scripts/smoke-test.sh
#
# Exit code 0 = all critical checks passed (deploy safe)
# Exit code 1 = at least one FAIL (do NOT deploy)
# WARN items are logged but don't block deploy.
# ================================================================

# ── Color helpers ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo -e "  ${YELLOW}WARN${NC} $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
info() { echo -e "  ${CYAN}INFO${NC} $1"; }
section() { echo -e "\n${BOLD}[$1]${NC}"; }

echo ""
echo -e "${BOLD}═══════════════════════════════════════════${NC}"
echo -e "${BOLD}  PUNCHLIST SMOKE TEST — v100-M7${NC}"
echo -e "${BOLD}═══════════════════════════════════════════${NC}"

# ================================================================
# 1. PRODUCTION BUILD
# ================================================================
section "1. Production Build"

if npm run build > /tmp/pl_build_output.txt 2>&1; then
  pass "Production build succeeded"

  if [ -d dist/assets ]; then
    CSS_FILE=$(find dist/assets -name '*.css' -type f 2>/dev/null | head -1)
    JS_FILES=$(find dist/assets -name '*.js' -type f 2>/dev/null)

    if [ -n "$CSS_FILE" ]; then
      CSS_KB=$(( $(wc -c < "$CSS_FILE") / 1024 ))
      info "CSS bundle: ${CSS_KB}KB"
    fi

    VENDOR_JS=$(echo "$JS_FILES" | grep -i vendor | head -1)
    MAIN_JS=$(echo "$JS_FILES" | grep -v vendor | head -1)

    if [ -n "$VENDOR_JS" ]; then
      VENDOR_KB=$(( $(wc -c < "$VENDOR_JS") / 1024 ))
      info "JS vendor:  ${VENDOR_KB}KB"
    fi
    if [ -n "$MAIN_JS" ]; then
      MAIN_KB=$(( $(wc -c < "$MAIN_JS") / 1024 ))
      info "JS main:    ${MAIN_KB}KB"
      if [ "$MAIN_KB" -gt 500 ]; then
        warn "Main JS bundle is ${MAIN_KB}KB (>500KB) — consider code splitting"
      fi
    fi

    TOTAL_BYTES=$(find dist -type f -exec cat {} + 2>/dev/null | wc -c)
    TOTAL_KB=$(( TOTAL_BYTES / 1024 ))
    info "Total dist: ${TOTAL_KB}KB"
  fi
else
  fail "Production build FAILED"
  tail -20 /tmp/pl_build_output.txt | sed 's/^/    /'
fi

# ================================================================
# 2. JSX TAG BALANCE CHECK
# ================================================================
section "2. JSX Tag Balance"

BALANCE_ISSUES=0
for f in src/pages/*.jsx src/components/*.jsx; do
  [ -f "$f" ] || continue
  BASENAME=$(basename "$f")

  # Count opening <div (includes self-closing <div ... />)
  ALL_OPEN_DIV=$(grep -o '<div' "$f" | wc -l)
  # Count self-closing <div ... /> (these don't need a </div>)
  SELF_CLOSE_DIV=$(grep -Eo '<div[^>]*/>' "$f" | wc -l)
  # Effective opens that need a </div>
  OPEN_DIV=$(( ALL_OPEN_DIV - SELF_CLOSE_DIV ))
  CLOSE_DIV=$(grep -o '</div>' "$f" | wc -l)

  if [ "$OPEN_DIV" -ne "$CLOSE_DIV" ]; then
    DIFF=$(( CLOSE_DIV - OPEN_DIV ))
    ABS_DIFF=${DIFF#-}  # absolute value
    if [ "$ABS_DIFF" -ge 2 ]; then
      # ±2 or more is likely a real issue
      fail "$BASENAME: <div ($OPEN_DIV effective) vs </div> ($CLOSE_DIV) — off by $DIFF"
      BALANCE_ISSUES=$((BALANCE_ISSUES + 1))
    else
      # ±1 is often a JSX ternary/fragment artifact — warn but don't fail
      warn "$BASENAME: <div ($OPEN_DIV effective) vs </div> ($CLOSE_DIV) — off by $DIFF (may be JSX conditional)"
    fi
  fi
done

for f in src/pages/public-*.jsx; do
  [ -f "$f" ] || continue
  BASENAME=$(basename "$f")
  OPEN_SHELL=$(grep -o '<PublicPageShell' "$f" | wc -l)
  CLOSE_SHELL=$(grep -o '</PublicPageShell>' "$f" | wc -l)
  if [ "$OPEN_SHELL" -ne "$CLOSE_SHELL" ]; then
    fail "$BASENAME: <PublicPageShell ($OPEN_SHELL) vs </PublicPageShell> ($CLOSE_SHELL)"
    BALANCE_ISSUES=$((BALANCE_ISSUES + 1))
  fi
done

if [ "$BALANCE_ISSUES" -eq 0 ]; then
  JSX_COUNT=$(ls src/pages/*.jsx src/components/*.jsx 2>/dev/null | wc -l)
  pass "All $JSX_COUNT JSX files have balanced tags"
fi

# ================================================================
# 3. PRICING INTEGRITY
# ================================================================
section "3. Pricing Integrity"

# Canonical: $29/mo, $249/yr (matches Stripe product catalog)
# Should ONLY be hardcoded in billing.js and landing.html
PRICING_ISSUES=0

for f in src/pages/*.jsx src/components/*.jsx; do
  [ -f "$f" ] || continue
  BASENAME=$(basename "$f")

  # Skip files that import PRICING — they're doing it right
  if grep -q 'PRICING' "$f"; then
    continue
  fi

  HITS=$(grep -n '\$29[^0-9]\|\$249\|\$299\|\$20\.75\|\$24\.92' "$f" 2>/dev/null)
  if [ -n "$HITS" ]; then
    warn "$BASENAME has hardcoded pricing (should import from billing.js):"
    echo "$HITS" | head -3 | sed 's/^/      /'
    PRICING_ISSUES=$((PRICING_ISSUES + 1))
  fi
done

if [ "$PRICING_ISSUES" -eq 0 ]; then
  pass "No hardcoded pricing outside billing.js / landing.html"
fi

# Verify billing.js ↔ landing.html consistency
BILLING_ANNUAL=$(grep 'annual:' src/lib/billing.js | head -1 | grep -Eo '[0-9]+')
LANDING_ANNUAL=$(grep 'id="price-num">' public/landing.html | head -1 | grep -Eo '[0-9]+' | head -1)

if [ -n "$BILLING_ANNUAL" ] && [ -n "$LANDING_ANNUAL" ]; then
  if [ "$BILLING_ANNUAL" = "$LANDING_ANNUAL" ]; then
    pass "billing.js annual (\$$BILLING_ANNUAL) matches landing.html (\$$LANDING_ANNUAL)"
  else
    fail "Pricing mismatch: billing.js=\$$BILLING_ANNUAL vs landing.html=\$$LANDING_ANNUAL"
  fi
fi

# ================================================================
# 4. VERCEL FUNCTION COUNT
# ================================================================
section "4. Vercel Function Count"

FUNC_COUNT=$(ls api/*.js 2>/dev/null | grep -v 'api/_' | wc -l)
if [ "$FUNC_COUNT" -gt 12 ]; then
  fail "$FUNC_COUNT serverless functions in api/ (Vercel Hobby max: 12)"
elif [ "$FUNC_COUNT" -eq 12 ]; then
  pass "$FUNC_COUNT serverless functions (at Hobby limit)"
else
  pass "$FUNC_COUNT serverless functions ($(( 12 - FUNC_COUNT )) slots remaining)"
fi

HELPER_COUNT=$(ls api/_*.js 2>/dev/null | wc -l)
info "$HELPER_COUNT helper files (prefixed with _, not counted)"

# ================================================================
# 5. IMPORT INTEGRITY
# ================================================================
section "5. Import Integrity"

IMPORT_ISSUES=0

for f in src/pages/*.jsx src/components/*.jsx; do
  [ -f "$f" ] || continue
  BASENAME=$(basename "$f")
  DIR=$(dirname "$f")

  # Extract relative import paths (skip npm packages)
  IMPORTS=$(grep -Eo "from\s+['\"](\./|\.\./)[^'\"]*['\"]" "$f" 2>/dev/null | sed "s/from[[:space:]]*['\"]//;s/['\"]$//")

  for IMPORT_PATH in $IMPORTS; do
    RESOLVED="$DIR/$IMPORT_PATH"

    FOUND=false
    for ext in "" ".js" ".jsx" ".json" "/index.js" "/index.jsx"; do
      if [ -e "${RESOLVED}${ext}" ]; then
        FOUND=true
        break
      fi
    done

    if ! $FOUND; then
      fail "$BASENAME: missing import '$IMPORT_PATH'"
      IMPORT_ISSUES=$((IMPORT_ISSUES + 1))
    fi
  done
done

if [ "$IMPORT_ISSUES" -eq 0 ]; then
  pass "All relative imports resolve to existing files"
fi

# ================================================================
# 6. API EXPORT CHECK
# ================================================================
section "6. API Export Check"

# Get all exported names from API modules (skip index.js re-exports)
ALL_EXPORTS=$(grep -rh '^export ' src/lib/api/*.js 2>/dev/null | \
  grep -v '^export \*' | \
  sed -E 's/.*(function |async function |const |let )([a-zA-Z_]+).*/\2/' | sort -u)

EXPORT_COUNT=$(echo "$ALL_EXPORTS" | wc -l)

# Get all named imports from api in page/component files
API_IMPORT_ISSUES=0
IMPORTED_NAMES=$(grep -rh "import" \
  src/pages/*.jsx src/components/*.jsx 2>/dev/null | \
  grep "lib/api" | \
  sed -E 's/.*\{([^}]+)\}.*/\1/' | tr ',' '\n' | \
  sed 's/[[:space:]]//g; s/as.*//g' | \
  grep -v '^$' | sort -u)

for FUNC_NAME in $IMPORTED_NAMES; do
  if ! echo "$ALL_EXPORTS" | grep -q "^${FUNC_NAME}$"; then
    fail "Import '$FUNC_NAME' from api not found in any API module"
    API_IMPORT_ISSUES=$((API_IMPORT_ISSUES + 1))
  fi
done

if [ "$API_IMPORT_ISSUES" -eq 0 ]; then
  pass "All API named imports match exports ($EXPORT_COUNT exports across modules)"
fi

# ================================================================
# 7. STORAGE HYGIENE
# ================================================================
section "7. Storage Hygiene"

STORAGE_OK=true
for KEY in "pl_job_context" "pl_scope_items" "pl_scope_meta"; do
  HITS=$(grep -rn "$KEY" src/pages/*.jsx src/components/*.jsx 2>/dev/null)
  if [ -n "$HITS" ]; then
    fail "Deprecated storage key '$KEY' still referenced"
    STORAGE_OK=false
  fi
done

if $STORAGE_OK; then
  pass "No references to deprecated storage keys"
fi

STORAGE_REFS=$(grep -rc 'sessionStorage\|localStorage' src/pages/*.jsx src/components/*.jsx 2>/dev/null | grep -v ':0$' | wc -l)
if [ "$STORAGE_REFS" -gt 0 ]; then
  info "$STORAGE_REFS files use localStorage/sessionStorage (review if unexpected)"
fi

# ================================================================
# 8. NATIVE DIALOG CHECK
# ================================================================
section "8. Native Dialog Check"

DIALOG_OK=true
for f in src/pages/*.jsx src/components/*.jsx; do
  [ -f "$f" ] || continue
  BASENAME=$(basename "$f")

  # Exclude comment lines (// and * doc comments)
  if grep -E 'window\.(confirm|alert)' "$f" 2>/dev/null | grep -Ev '^\s*(//|\*)' | grep -q .; then
    warn "$BASENAME uses native browser dialogs (should use ConfirmModal)"
    DIALOG_OK=false
  fi

  # Bare prompt() — exclude comments and unrelated matches
  if grep -E '\bprompt\s*\(' "$f" 2>/dev/null | grep -Ev '//|upgrade.prompt|UpgradePrompt' | grep -q .; then
    warn "$BASENAME uses window.prompt()"
    DIALOG_OK=false
  fi
done

if $DIALOG_OK; then
  pass "No native browser dialogs in pages or components"
fi

# ================================================================
# 9. LANDING PAGE CHECK
# ================================================================
section "9. Landing Page Check"

if [ ! -f public/landing.html ]; then
  fail "public/landing.html does not exist"
else
  LANDING_SIZE=$(wc -c < public/landing.html)
  LANDING_KB=$(( LANDING_SIZE / 1024 ))

  if [ "$LANDING_SIZE" -lt 10240 ]; then
    fail "landing.html is only ${LANDING_KB}KB (expected >10KB — may be truncated)"
  else
    pass "landing.html exists (${LANDING_KB}KB)"
  fi

  grep -q 'href="/signup"' public/landing.html && pass "landing.html → /signup" || fail "landing.html missing /signup link"
  grep -q 'href="/login"' public/landing.html && pass "landing.html → /login" || fail "landing.html missing /login link"
  grep -q 'id="pricing"' public/landing.html && pass "landing.html has pricing section" || fail "landing.html missing pricing section"
fi

# ================================================================
# 10. README SYNC
# ================================================================
section "10. README Sync"

if [ ! -f README.md ]; then
  warn "README.md not found"
else
  if grep -qi 'v61' README.md; then
    pass "README mentions v61"
  else
    warn "README may not reference current version (v61)"
  fi

  README_FUNC_COUNT=$(grep -Eo '[0-9]+\s+total' README.md | grep -Eo '[0-9]+' | head -1)
  if [ -n "$README_FUNC_COUNT" ]; then
    if [ "$README_FUNC_COUNT" = "$FUNC_COUNT" ]; then
      pass "README function count ($README_FUNC_COUNT) matches actual ($FUNC_COUNT)"
    else
      warn "README says $README_FUNC_COUNT functions, actual is $FUNC_COUNT"
    fi
  fi
fi

# ================================================================
# 11. DUPLICATE EXPORT CHECK
# ================================================================
section "11. Duplicate Exports"

DUPES=$(grep -rh '^export ' src/lib/api/*.js 2>/dev/null | \
  grep -v '^export \*' | \
  sed -E 's/.*(function |async function |const |let )([a-zA-Z_]+).*/\2/' | \
  sort | uniq -d)

if [ -n "$DUPES" ]; then
  warn "Duplicate export names across API modules (may shadow):"
  echo "$DUPES" | sed 's/^/      /'
else
  pass "No duplicate export names across API modules"
fi

# ================================================================
# 12. CRITICAL FILE EXISTENCE
# ================================================================
section "12. Critical Files"

CRITICAL_FILES=(
  "src/main.jsx"
  "src/app/router.jsx"
  "src/lib/supabase.js"
  "src/lib/billing.js"
  "src/lib/api/index.js"
  "src/components/app-shell.jsx"
  "src/components/public-page-shell.jsx"
  "src/pages/dashboard-page.jsx"
  "src/pages/public-quote-page.jsx"
  "src/pages/public-invoice-page.jsx"
  "public/landing.html"
  "public/manifest.json"
  "public/sw.js"
  "vercel.json"
  "vite.config.js"
  "api/mark-messages-read.js"
  "api/send-followup.js"
  "supabase/functions/send-deposit-receipt/index.ts"
)

MISSING_CRITICAL=0
for cf in "${CRITICAL_FILES[@]}"; do
  if [ ! -f "$cf" ]; then
    fail "Missing critical file: $cf"
    MISSING_CRITICAL=$((MISSING_CRITICAL + 1))
  fi
done

if [ "$MISSING_CRITICAL" -eq 0 ]; then
  pass "All ${#CRITICAL_FILES[@]} critical files present"
fi

# ================================================================
# 13. v100 ENDPOINT SHAPE CHECK
# ================================================================
# M7 scope §c — exercise the new endpoints statically. We can't make
# real HTTP calls (no running server here); instead we grep the handler
# contracts so any drift from what the UI calls catches a deploy.
section "13. v100 Endpoint Shape"

# 13a. /api/send-followup — must validate {quoteId, method, customMessage?}
if [ -f api/send-followup.js ]; then
  if grep -qE 'quoteId' api/send-followup.js && grep -qE "method" api/send-followup.js; then
    pass "send-followup handler reads {quoteId, method}"
  else
    fail "send-followup handler missing quoteId/method extraction"
  fi
  # Atomic RPC per M3 spec
  if grep -q 'rpc_record_followup_send' api/send-followup.js; then
    pass "send-followup calls rpc_record_followup_send (atomic counter)"
  else
    warn "send-followup does not reference rpc_record_followup_send — confirm intentional"
  fi
else
  fail "api/send-followup.js missing"
fi

# 13b. /api/mark-messages-read — M4 dashboard integration (token-auth)
if [ -f api/mark-messages-read.js ]; then
  if grep -qE '\btoken\b' api/mark-messages-read.js; then
    pass "mark-messages-read handler reads share token"
  else
    warn "mark-messages-read handler shape unclear — manual review suggested"
  fi
else
  fail "api/mark-messages-read.js missing"
fi

# 13c. dashboard_bundle RPC present in migrations
if [ -f supabase/function_dashboard_bundle.sql ]; then
  pass "dashboard_bundle RPC SQL present"
else
  fail "supabase/function_dashboard_bundle.sql missing"
fi

# 13d. Dashboard page consumes the bundle (not N+1 fetches)
if [ -f src/pages/dashboard-page.jsx ]; then
  if grep -qE "dashboard_bundle|DashboardBundle" src/pages/dashboard-page.jsx src/lib/api/*.js 2>/dev/null; then
    pass "dashboard-page.jsx (or api/) calls dashboard_bundle RPC"
  else
    warn "No dashboard_bundle reference found — verify Workstream B wiring"
  fi
fi

# ================================================================
# 14. v100 TEST HARNESS
# ================================================================
# M7 scope §a–§b — Playwright specs exist & package.json scripts align.
section "14. v100 Test Harness"

TEST_SPECS=(
  "playwright.config.ts"
  "tests/v100-visual.spec.ts"
  "tests/v100-perf.spec.ts"
  "tests/v100-a11y.spec.ts"
  "tests/helpers/routes.ts"
  "tests/helpers/context.ts"
)
MISSING_TESTS=0
for tf in "${TEST_SPECS[@]}"; do
  if [ ! -f "$tf" ]; then
    fail "Missing M7 test artifact: $tf"
    MISSING_TESTS=$((MISSING_TESTS + 1))
  fi
done
if [ "$MISSING_TESTS" -eq 0 ]; then
  pass "All ${#TEST_SPECS[@]} M7 test artifacts present"
fi

# Scripts line up with the filenames
if grep -q '"test:e2e"' package.json; then
  pass "package.json has test:e2e script"
else
  warn "package.json is missing test:e2e script"
fi

# ================================================================
# 15. SCROLL-TRAP REGRESSION GUARD (M7 §d)
# ================================================================
# The M7 cleanup removed vestigial props from .app-main. Guard against
# their accidental reintroduction — they are no-ops here and could mask
# the real scroll-trap root cause if they come back.
section "15. Scroll-trap Cleanup Guard"

if grep -nE '\.app-main\s*\{[^}]*-webkit-overflow-scrolling' src/styles/index.css > /dev/null 2>&1; then
  fail ".app-main has -webkit-overflow-scrolling — removed in M7, see V100-QA-REPORT.md §4"
else
  pass ".app-main is clean (no -webkit-overflow-scrolling)"
fi

if grep -nE '\.app-main\s*\{[^}]*overscroll-behavior' src/styles/index.css > /dev/null 2>&1; then
  fail ".app-main has overscroll-behavior — body (line ~675) is the correct containment root"
else
  pass ".app-main does not duplicate body overscroll-behavior"
fi

# ================================================================
# SUMMARY
# ================================================================
echo ""
echo -e "${BOLD}═══════════════════════════════════════════${NC}"
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
echo -e "  ${GREEN}$PASS_COUNT PASS${NC}  ${RED}$FAIL_COUNT FAIL${NC}  ${YELLOW}$WARN_COUNT WARN${NC}  ($TOTAL checks)"
echo -e "${BOLD}═══════════════════════════════════════════${NC}"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "\n  ${RED}${BOLD}✗ SMOKE TEST FAILED — DO NOT DEPLOY${NC}\n"
  exit 1
else
  echo -e "\n  ${GREEN}${BOLD}✓ ALL CRITICAL CHECKS PASSED${NC}\n"
  exit 0
fi
