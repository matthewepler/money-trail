import { expect, test } from '@playwright/test';
import { resetWithUser } from './support/ledger.js';
import { FIXTURE, nav, signIn } from './support/ui.js';

test.beforeEach(async () => {
  await resetWithUser();
});

test('sign in, import a Chase export, see the ledger and the spending summary, sign out', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await signIn(page);

  // An empty ledger points at the import, whose panel is already open.
  await expect(page.getByText('No transactions yet')).toBeVisible();
  await page.getByLabel('CSV file').setInputFiles(FIXTURE);
  await page.getByRole('button', { name: 'Import' }).click();

  await expect(page.getByRole('status')).toHaveText('Imported 8 transactions. 2 need a category.');
  const rows = page.getByRole('listitem');
  await expect(rows).toHaveCount(8);
  await expect(rows.filter({ hasText: 'ACME PAYROLL' })).toContainText('+$2,450.00');
  await expect(rows.filter({ hasText: 'ACME PAYROLL' })).toContainText('Income');
  await expect(rows.filter({ hasText: 'CHECK 1042' })).toContainText('Uncategorized');
  await expect(rows.filter({ hasText: 'CORNER BAKERY' })).toHaveCount(2);

  // The fixture is September 2026; the summary opens on the current month, so ask for it.
  await nav(page, 'Summary').click();
  await page.getByLabel('From').fill('2026-09-01');
  await page.getByLabel('To').fill('2026-09-30');

  await expect(page.getByLabel('Total spending')).toContainText('$165.40');
  const categories = page.getByRole('listitem');
  await expect(categories).toHaveCount(3);
  await expect(categories.nth(0)).toContainText('Uncategorized');
  await expect(categories.nth(0)).toContainText('$143.90');
  await expect(categories.nth(1)).toContainText('Bank fees');
  await expect(categories.nth(2)).toContainText('Food & drink');
  // Transfers sit outside the total, on their own line (ADR-0011).
  await expect(page.getByLabel('Transfers out, not matched')).toContainText('$560.00');

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  // Signing out ended the session on the server, not just in the page.
  expect((await page.request.get('/api/session')).status()).toBe(401);
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
});
