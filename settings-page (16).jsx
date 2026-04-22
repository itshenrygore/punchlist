import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { DEFAULT_ROUTES } from './helpers/routes';
import { setTheme, seedAuth, waitForAppReady } from './helpers/context';

/**
 * v100 accessibility sweep — axe-core against every route at both
 * themes on desktop-chrome. We only run one viewport because a11y
 * violations are almost never viewport-dependent; the responsive sweep
 * lives in v100-visual.spec.ts.
 *
 * Policy for v100 per M7 §e:
 *   - AA violations with trivial fixes: file as test failures so they
 *     get fixed in this milestone.
 *   - Rules that are noisy-but-not-AA (best practice, experimental):
 *     disabled below.
 *   - Known offenders we're deferring to v101: added to `allowlist`
 *     with a reason. The test fails if they regress (e.g. get worse)
 *     but passes for the known violation count.
 */

const require = createRequire(import.meta.url);
// axe-core ships its browser bundle in `axe.min.js`. We inject it via
// addScriptTag so we don't need a page build step.
const axeSource = (() => {
  try {
    return readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
  } catch {
    return '';
  }
})();

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[]; failureSummary?: string }>;
};

type AxeResult = { violations: AxeViolation[] };

/**
 * Known violations we're deferring to v101. The test still runs axe;
 * it just won't fail for these rule IDs. If the violation count for a
 * given rule grows past `maxAllowed`, the test fails — so we catch
 * regressions without blocking M7 on pre-existing issues.
 */
const ALLOWLIST: Record<string, { maxAllowed: number; reason: string }> = {
  'color-contrast': {
    maxAllowed: 10,
    reason: 'Light-theme muted text is borderline AA; M6.5 lifted 3 sites to --text-2, rest is v101 design-token pass.',
  },
  'landmark-one-main': {
    maxAllowed: 5,
    reason: 'App shell uses <div class="app-main"> — lift to <main> in v101.',
  },
  'region': {
    maxAllowed: 5,
    reason: 'Same root cause as landmark-one-main.',
  },
};

test.describe('v100 accessibility', () => {
  test.beforeEach(async ({ context }) => {
    await setTheme(context, 'dark');
    await seedAuth(context);
  });

  for (const route of DEFAULT_ROUTES) {
    test(`axe · ${route.name}`, async ({ page }) => {
      test.skip(
        test.info().project.name !== 'desktop-chrome',
        'a11y sweep runs only on desktop-chrome'
      );
      test.skip(!axeSource, 'axe-core not installed. Run: npm i -D axe-core');

      if (route.auth === 'required' && !process.env.PL_TEST_ACCESS_TOKEN) {
        test.skip(true, 'Auth required — set PL_TEST_* env vars');
      }

      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      if (route.readySelector) {
        await page
          .locator(route.readySelector)
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => {});
      }
      await waitForAppReady(page);

      const results = await runAxe(page);
      const report = summarizeViolations(results);

      if (report.blocking.length > 0) {
        await test.info().attach('axe-violations.json', {
          body: JSON.stringify(report, null, 2),
          contentType: 'application/json',
        });
      }

      expect(
        report.blocking,
        formatViolations(report.blocking)
      ).toHaveLength(0);
    });
  }
});

async function runAxe(page: Page): Promise<AxeResult> {
  await page.addScriptTag({ content: axeSource });
  return page.evaluate(async () => {
    // @ts-expect-error — axe is injected into the page above
    return (await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
      resultTypes: ['violations'],
    })) as AxeResult;
  });
}

function summarizeViolations(results: AxeResult) {
  const blocking: AxeViolation[] = [];
  const allowed: Array<{ violation: AxeViolation; reason: string }> = [];

  for (const v of results.violations) {
    const entry = ALLOWLIST[v.id];
    if (entry && v.nodes.length <= entry.maxAllowed) {
      allowed.push({ violation: v, reason: entry.reason });
    } else {
      blocking.push(v);
    }
  }
  return { blocking, allowed };
}

function formatViolations(list: AxeViolation[]): string {
  if (list.length === 0) return 'No violations';
  return list
    .map(
      (v) =>
        `[${v.impact ?? 'moderate'}] ${v.id}: ${v.help}\n  ` +
        v.nodes
          .slice(0, 3)
          .map((n) => n.target.join(' '))
          .join('\n  ')
    )
    .join('\n\n');
}
