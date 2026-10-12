import { expect, test } from '@playwright/test';
import { E2E_EMAIL } from './support/env.js';
import { endAllSessions, resetWithUser } from './support/ledger.js';
import { nav, signIn } from './support/ui.js';

test.beforeEach(async () => {
  await resetWithUser();
});

test('a wrong password is explained in plain words and keeps the user on sign-in', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('opening a deep link while signed out goes to sign-in, and a signed-in visit stays put', async ({
  page,
}) => {
  await page.goto('/summary');
  await expect(page).toHaveURL(/\/login$/);

  await signIn(page);
  await page.goto('/summary');
  await expect(page.getByRole('heading', { name: 'Summary' })).toBeVisible();
});

test('a session that ends while the page is open sends the user back to sign-in', async ({
  page,
}) => {
  await signIn(page);

  await endAllSessions();
  await nav(page, 'Summary').click();

  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});
