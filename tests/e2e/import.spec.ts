import { expect, test } from '@playwright/test';
import { resetWithUser } from './support/ledger.js';
import { CSV_HEADER, csvFile, signIn } from './support/ui.js';

test.beforeEach(async () => {
  await resetWithUser();
  // Each test signs in itself, through the real form.
});

async function importFile(page: import('@playwright/test').Page, file: ReturnType<typeof csvFile>) {
  await page.getByLabel('CSV file').setInputFiles(file);
  await page.getByRole('button', { name: 'Import' }).click();
}

test('a file that is not a Chase checking export is refused, and nothing is stored', async ({
  page,
}) => {
  await signIn(page);

  await importFile(
    page,
    csvFile('Transaction Date,Post Date,Description,Category,Type,Amount,Memo'),
  );

  await expect(page.getByRole('alert')).toContainText('isn’t a Chase checking export');
  await expect(page.getByText('No transactions yet')).toBeVisible();
});

test('a bad row is named, and none of the file is stored', async ({ page }) => {
  await signIn(page);

  await importFile(
    page,
    csvFile(
      CSV_HEADER,
      'DEBIT,09/28/2026,"COFFEE",-4.75,DEBIT_CARD, ,,',
      'DEBIT,13/45/2026,"TEA",-3.00,DEBIT_CARD, ,,',
    ),
  );

  await expect(page.getByRole('alert')).toHaveText(
    "row 3: date '13/45/2026' is not a real calendar date",
  );
  await expect(page.getByText('No transactions yet')).toBeVisible();
});

test('a long ledger is paged: 50 at a time, until there is no more', async ({ page }) => {
  await signIn(page);
  const rows = Array.from(
    { length: 120 },
    (_, i) =>
      `DEBIT,09/${String((i % 28) + 1).padStart(2, '0')}/2026,"STORE ${i}",-${i + 1}.00,DEBIT_CARD, ,,`,
  );

  await importFile(page, csvFile(CSV_HEADER, ...rows));
  await expect(page.getByRole('status')).toHaveText(
    'Imported 120 transactions. 120 need a category.',
  );

  const items = page.getByRole('listitem');
  await expect(items).toHaveCount(50);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(items).toHaveCount(100);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(items).toHaveCount(120);
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
});
