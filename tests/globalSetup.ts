import { prepareTestDatabase } from './helpers/prepareTestDatabase.js';

// Runs once before any test file.
export async function setup(): Promise<void> {
  await prepareTestDatabase();
}
