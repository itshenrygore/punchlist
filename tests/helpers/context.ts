import { Page, BrowserContext } from '@playwright/test';

/**
 * Seed localStorage with a theme before the app boots.
 *
 * The app reads `pl_theme` on first render via src/lib/theme.js.
 * Seeding via addInitScript ensures the value is present BEFORE any
 * React code runs, avoiding a flash of the wrong theme.
 */
export async function setTheme(context: BrowserContext, theme: 'light' | 'dark') {
  await context.addInitScript((t) => {
    try {
      window.localStorage.setItem('pl_theme', t);
      // The theme utility also writes a data-theme attr on <html> on
      // boot; mirror it here so pre-hydration snapshots are correct.
      document.documentElement.setAttribute('data-theme', t);
    } catch {
      /* private mode — best effort */
    }
  }, theme);
}

/**
 * Disable motion globally for a page. Complements the
 * animations:'disabled' flag on toHaveScreenshot by also blanking out
 * CSS transitions/animations that Playwright's animation pauser misses
 * (e.g. keyframes keyed off custom properties).
 */
export async function disableMotion(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `,
  });
}

/**
 * Wait for the app shell to be visibly ready. Uses two signals:
 *   1. networkidle — all Supabase fetches have settled
 *   2. no skeleton placeholders in the DOM
 *
 * Both are needed because networkidle fires before React flushes the
 * final paint in some cases.
 */
export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page
    .locator('[data-skeleton], .skeleton, [aria-busy="true"]')
    .first()
    .waitFor({ state: 'detached', timeout: 5_000 })
    .catch(() => {
      /* Skeletons may not exist on this route — that's fine. */
    });
  // One more frame to let the M6.5 .dv2-enter stagger complete (we
  // already disabled motion, but tokens.css zeroes durations via
  // prefers-reduced-motion; belt-and-braces).
  await page.waitForTimeout(50);
}

/**
 * Seed an authenticated Supabase session into localStorage.
 *
 * This uses the same shape the supabase-js client writes on successful
 * login. The test fixture provides real credentials via env vars:
 *   PL_TEST_EMAIL / PL_TEST_PASSWORD   — a seeded Pro account
 *   PL_SUPABASE_URL / PL_SUPABASE_ANON — public project info
 *
 * If these are missing, the helper no-ops and the test is expected to
 * fall back to the login page (auth-gated routes will redirect).
 */
export async function seedAuth(context: BrowserContext) {
  const token = process.env.PL_TEST_ACCESS_TOKEN;
  const refresh = process.env.PL_TEST_REFRESH_TOKEN;
  const userId = process.env.PL_TEST_USER_ID;
  const email = process.env.PL_TEST_EMAIL;
  const projectRef = process.env.PL_SUPABASE_PROJECT_REF;

  if (!token || !refresh || !userId || !projectRef) {
    return { seeded: false as const };
  }

  const key = `sb-${projectRef}-auth-token`;
  const session = {
    access_token: token,
    refresh_token: refresh,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    expires_in: 3600,
    token_type: 'bearer',
    user: { id: userId, email, aud: 'authenticated', role: 'authenticated' },
  };

  await context.addInitScript(
    ({ k, v }) => {
      try {
        window.localStorage.setItem(k, JSON.stringify(v));
      } catch {
        /* best effort */
      }
    },
    { k: key, v: session }
  );

  return { seeded: true as const };
}
