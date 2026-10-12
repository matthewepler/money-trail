import { prepareTestDatabase } from '../../helpers/prepareTestDatabase.js';

// Playwright requires a default export here.
export default async function globalSetup(): Promise<void> {
  await prepareTestDatabase();
}
