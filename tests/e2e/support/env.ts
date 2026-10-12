// Shared by playwright.config.ts and the specs. The e2e stack runs on its own ports so it
// can never collide with `npm run dev` (3000 / 5173), and on the _test database.
export const API_PORT = 3100;
export const WEB_PORT = 4173;

// A throwaway account on a throwaway database; not a real credential.
export const E2E_EMAIL = 'e2e@money-trail.local';
export const E2E_PASSWORD = 'e2e-test-password-123';
