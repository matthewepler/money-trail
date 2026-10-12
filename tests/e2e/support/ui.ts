import { expect, type Page } from '@playwright/test';
import { E2E_EMAIL, E2E_PASSWORD } from './env.js';

export const FIXTURE = 'fixtures/chase-checking.csv';
export const CSV_HEADER = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #';

export async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible();
}

export function csvFile(...lines: string[]) {
  return {
    name: 'activity.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(lines.join('\n') + '\n'),
  };
}

export function nav(page: Page, name: 'Transactions' | 'Summary') {
  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name });
}
