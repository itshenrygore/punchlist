import { test, expect } from '@playwright/test';
import { DEFAULT_ROUTES, THEMES } from './helpers/routes';
import {
  setTheme,
  disableMotion,
  waitForAppReady,
  seedAuth,
} from './helpers/context';

/**
 * v100 visual regression sweep.
 *
 * Produces one snapshot per (route, viewport, theme) triple. The
 * viewport comes from the --project= Playwright flag (5 projects in
 * playwright.config.ts); theme comes from the `describe` loop below.
 *
 * First run writes baselines to tests/__screenshots__/v100/. Subsequent
 * runs diff against them. Update with:
 *     npx playwright test tests/v100-visual.spec.ts --update-snapshots
 *
 * Auth-gated routes are conditional: if the PL_TEST_* env vars are
 * present, we seed a session; otherwise those tests are skipped rather
 * than capturing login-redirect noise as the "baseline".
 */

for (const theme of THEMES) {
  test.describe(`v100 visual · ${theme} theme`, () => {
    test.beforeEach(async ({ context, page }) => {
      await setTheme(context, theme);
      const { seeded } = await seedAuth(context);
      // Stash on test info for per-test gating of required-auth routes.
      (page as unknown as { _authSeeded: boolean })._authSeeded = seeded;
    });

    for (const route of DEFAULT_ROUTES) {
      test(`${route.name}`, async ({ page }) => {
        if (route.auth === 'required') {
          const seeded = (page as unknown as { _authSeeded: boolean })._authSeeded;
          test.skip(
            !seeded,
            `Auth required: set PL_TEST_ACCESS_TOKEN / PL_TEST_REFRESH_TOKEN / PL_TEST_USER_ID / PL_SUPABASE_PROJECT_REF`
          );
        }

        await page.goto(route.path, { waitUntil: 'domcontentloaded' });
        await disableMotion(page);

        if (route.readySelector) {
          await page
            .locator(route.readySelector)
            .first()
            .waitFor({ state: 'visible', timeout: 10_000 })
            .catch(() => {
              /* Route may legitimately render without this selector (e.g. 404). */
            });
        }

        await waitForAppReady(page);

        // Fonts loaded — critical for text-rendering diffs.
        await page.evaluate(() => (document as Document & { fonts?: FontFaceSet }).fonts?.ready);

        const masks = (route.mask ?? []).map((sel) => page.locator(sel));

        await expect(page).toHaveScreenshot(`${route.name}-${theme}.png`, {
          fullPage: true,
          mask: masks,
          maxDiffPixelRatio: 0.002,
        });
      });
    }
  });
}
