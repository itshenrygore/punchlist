import { test, expect, Page } from '@playwright/test';
import { setTheme, seedAuth, waitForAppReady } from './helpers/context';

/**
 * v100 performance benchmark — §4.3 target: dashboard_bundle p95 <200ms.
 *
 * The benchmark runs only on desktop-chrome (single project) to avoid
 * device-emulation overhead skewing the numbers. It needs a seeded
 * account with ~100 quotes — per the M7 prompt, the human running this
 * provisions PL_TEST_* env vars pointing at such an account.
 *
 * Methodology:
 *  1. Measure the server-side time by timing the RPC call on the
 *     network (request → response) minus TLS/DNS warm-up. We warm the
 *     connection with a pre-flight GET to the origin.
 *  2. Run the dashboard navigation 15 times, discarding the first 5
 *     as warm-up. p95 computed from the remaining 10 samples.
 *  3. Fail if p95 >= 200ms.
 */

test.describe('v100 performance', () => {
  test.beforeEach(async ({ context }) => {
    await setTheme(context, 'dark');
    const { seeded } = await seedAuth(context);
    test.skip(!seeded, 'Performance test requires a seeded Pro account with 100 quotes');
  });

  test('dashboard_bundle RPC p95 under 200ms', async ({ page }) => {
    test.skip(
      test.info().project.name !== 'desktop-chrome',
      'Perf is measured only on desktop-chrome'
    );

    const samples: number[] = [];
    const RUNS = 15;
    const WARMUP = 5;

    // Warm-up the connection pool.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    for (let i = 0; i < RUNS; i++) {
      const timing = await measureDashboardBundle(page);
      if (timing != null) samples.push(timing);
    }

    const measured = samples.slice(WARMUP);
    expect(
      measured.length,
      `Expected at least ${RUNS - WARMUP} valid samples after warm-up, got ${measured.length}`
    ).toBeGreaterThanOrEqual(RUNS - WARMUP);

    const p50 = percentile(measured, 0.5);
    const p95 = percentile(measured, 0.95);
    const max = Math.max(...measured);

    console.log(`[perf] dashboard_bundle  n=${measured.length}  p50=${p50.toFixed(0)}ms  p95=${p95.toFixed(0)}ms  max=${max.toFixed(0)}ms`);

    // Attach raw samples for debugging.
    await test.info().attach('dashboard_bundle_samples.json', {
      body: JSON.stringify({ samples: measured, p50, p95, max }, null, 2),
      contentType: 'application/json',
    });

    expect(p95, `p95 of ${p95.toFixed(0)}ms exceeds 200ms target`).toBeLessThan(200);
  });
});

async function measureDashboardBundle(page: Page): Promise<number | null> {
  // Navigate away first so the dashboard refetches on return.
  await page.goto('/app/settings', { waitUntil: 'domcontentloaded' });

  const responsePromise = page.waitForResponse(
    (res) => {
      const url = res.url();
      // Supabase RPC endpoint shape: /rest/v1/rpc/dashboard_bundle
      return url.includes('/rpc/dashboard_bundle') && res.request().method() === 'POST';
    },
    { timeout: 15_000 }
  );

  const start = Date.now();
  await page.goto('/app', { waitUntil: 'domcontentloaded' });

  try {
    const res = await responsePromise;
    const timing = res.request().timing();
    // timing.responseEnd is ms from request start — what we want.
    const duration = timing.responseEnd > 0 ? timing.responseEnd : Date.now() - start;
    await waitForAppReady(page);
    return duration;
  } catch {
    return null;
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[Math.max(0, idx)];
}
