import { expect, test, type Page } from '@playwright/test';
import { resetWithUser } from './support/ledger.js';
import { CSV_HEADER, nav, signIn } from './support/ui.js';

const VIEWPORTS = [
  { name: 'phone 375x667', width: 375, height: 667, bottomBar: true },
  { name: 'tablet 768x1024', width: 768, height: 1024, bottomBar: false },
  { name: 'desktop 1280x800', width: 1280, height: 800, bottomBar: false },
];

type Layout = {
  horizontalOverflow: boolean;
  targetsUnder44px: string[];
  navFixed: boolean;
  navTop: number;
  lastContentBottom: number;
};

// Measured in the page, after scrolling to the end, as a user would meet it.
async function measure(page: Page): Promise<Layout> {
  return page.evaluate(() => {
    const small = [
      ...document.querySelectorAll('button, a[href], input, summary, select, textarea'),
    ]
      .filter((el) => {
        const { width, height } = el.getBoundingClientRect();
        return width > 0 && height > 0 && (width < 44 || height < 44);
      })
      .map((el) => {
        const { width, height } = el.getBoundingClientRect();
        const label = (el.textContent ?? '').trim().slice(0, 24) || el.id;
        return `${el.tagName.toLowerCase()} "${label}" ${Math.round(width)}x${Math.round(height)}`;
      });

    window.scrollTo(0, document.body.scrollHeight);
    const navEl = document.querySelector('nav');
    const main = document.querySelector('main');
    const visible = [...(main?.querySelectorAll('li, button, p, section') ?? [])].filter(
      (el) => el.getBoundingClientRect().height > 0,
    );
    const last = visible[visible.length - 1];

    return {
      horizontalOverflow:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      targetsUnder44px: small,
      navFixed: navEl ? getComputedStyle(navEl).position === 'fixed' : false,
      navTop: navEl ? Math.round(navEl.getBoundingClientRect().top) : Infinity,
      lastContentBottom: last ? Math.round(last.getBoundingClientRect().bottom) : 0,
    };
  });
}

async function importSixtyRows(page: Page) {
  const rows = Array.from(
    { length: 60 },
    (_, i) =>
      `DEBIT,09/${String((i % 28) + 1).padStart(2, '0')}/2026,"STORE ${i}",-${i + 1}.00,DEBIT_CARD, ,,`,
  );
  const response = await page.request.post('/api/imports?account=Chase+checking', {
    headers: { 'content-type': 'text/csv' },
    data: [CSV_HEADER, ...rows].join('\n') + '\n',
  });
  expect(response.status()).toBe(201);
}

for (const viewport of VIEWPORTS) {
  test.describe(viewport.name, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test.beforeEach(async () => {
      await resetWithUser();
    });

    function expectFits(layout: Layout) {
      expect(layout.horizontalOverflow, 'horizontal scroll').toBe(false);
      expect(layout.targetsUnder44px, 'touch targets under 44px').toEqual([]);
      // Content must end above a fixed tab bar, never beneath it.
      if (layout.navFixed) expect(layout.lastContentBottom).toBeLessThanOrEqual(layout.navTop);
    }

    test('the sign-in screen fits', async ({ page }) => {
      await page.goto('/login');
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

      expectFits(await measure(page));
    });

    test('the transactions screen fits, with a long list and the import panel open', async ({
      page,
    }) => {
      await signIn(page);
      await importSixtyRows(page);
      await page.reload();
      await expect(page.getByRole('listitem')).toHaveCount(50);
      await page.getByText('Import a CSV').click();

      const layout = await measure(page);

      expectFits(layout);
      expect(layout.navFixed).toBe(viewport.bottomBar);
    });

    test('the summary screen fits', async ({ page }) => {
      await signIn(page);
      await importSixtyRows(page);
      await nav(page, 'Summary').click();
      await page.getByLabel('From').fill('2026-09-01');
      await page.getByLabel('To').fill('2026-09-30');
      await expect(page.getByLabel('Total spending')).toContainText('$');
      await expect(page.getByLabel('Transfers out, not matched')).toHaveCount(0);

      expectFits(await measure(page));
    });

    test(`the navigation is a ${viewport.bottomBar ? 'bar along the bottom' : 'strip under the header'}`, async ({
      page,
    }) => {
      await signIn(page);

      const boxes = await page.evaluate(() => {
        const top = (selector: string) =>
          document.querySelector(selector)?.getBoundingClientRect().top ?? -1;
        const navBox = document.querySelector('nav')?.getBoundingClientRect();
        return {
          header: top('header'),
          nav: top('nav'),
          main: top('main'),
          navBottom: navBox?.bottom ?? -1,
        };
      });

      if (viewport.bottomBar) {
        expect(boxes.navBottom).toBe(viewport.height);
      } else {
        expect(boxes.header).toBeLessThan(boxes.nav);
        expect(boxes.nav).toBeLessThan(boxes.main);
      }
    });
  });
}
