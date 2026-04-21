import { defineConfig, devices } from '@playwright/test';

/**
 * Punchlist v100 — Playwright configuration
 *
 * Device matrix per PHASE4-V100-PLAN.md §10:
 *   - iPhone SE   (375×667)  — smallest supported phone
 *   - iPhone 14   (393×852)  — modern phone
 *   - iPad        (768×1024) — tablet
 *   - MacBook 13" (1280×800) — laptop
 *   - Desktop 27" (2560×1440) — large monitor
 *
 * Each viewport is run against both dark and light themes, which are
 * applied via localStorage seeding in tests/helpers/theme.ts before
 * navigation (the app reads `pl_theme` on boot).
 *
 * Screenshots land in tests/__screenshots__/v100/ via toHaveScreenshot
 * baseline storage. First run produces baselines; subsequent runs
 * diff against them.
 *
 * Existing scripts in package.json consume --project= filters, so
 * project names remain stable: desktop-chrome, mobile-iphone.
 */

const BASE_URL = process.env.PL_BASE_URL || 'http://localhost:4173';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/__report__', open: 'never' }],
    ['json', { outputFile: 'tests/__report__/results.json' }],
  ],
  timeout: 45_000,
  expect: {
    // 0.2% pixel-diff tolerance — font anti-aliasing moves a few pixels
    // between runs even without real changes.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  snapshotDir: 'tests/__screenshots__',
  snapshotPathTemplate: 'tests/__screenshots__/v100/{testFilePath}/{arg}-{projectName}{ext}',

  projects: [
    // ── Mobile (phones) ────────────────────────────────────
    {
      name: 'mobile-iphone',
      use: {
        ...devices['iPhone SE'],
        viewport: { width: 375, height: 667 },
      },
    },
    {
      name: 'mobile-iphone-14',
      use: {
        ...devices['iPhone 14 Pro'],
        viewport: { width: 393, height: 852 },
      },
    },

    // ── Tablet ─────────────────────────────────────────────
    {
      name: 'tablet-ipad',
      use: {
        ...devices['iPad (gen 7)'],
        viewport: { width: 768, height: 1024 },
      },
    },

    // ── Desktop ────────────────────────────────────────────
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'desktop-large',
      use: {
        ...devices['Desktop Chrome HiDPI'],
        viewport: { width: 2560, height: 1440 },
      },
    },
  ],

  // Spin up the preview server automatically. Works both locally and
  // in CI; a pre-started server (PL_BASE_URL) bypasses this.
  webServer: process.env.PL_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run preview -- --port 4173',
        url: BASE_URL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
      },
});
