import { expect, test } from '@playwright/test';
import { resetWithUser } from './support/ledger.js';

test.beforeEach(async () => {
  await resetWithUser();
});

test('a signed-out visitor lands on the sign-in screen', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('the web server forwards /api to the API on the same origin', async ({ request }) => {
  const response = await request.get('/api/session');

  expect(response.status()).toBe(401);
  expect((await response.json()).error.code).toBe('AUTH_REQUIRED');
});
