import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import { deriveTestDatabaseUrl } from './tests/helpers/testDatabase.js';

// Tests run against <database>_test, never the dev database (see tests/helpers/testDatabase.ts).
function testEnv(env: Record<string, string>): Record<string, string> {
  return env.DATABASE_URL ? { ...env, DATABASE_URL: deriveTestDatabaseUrl(env.DATABASE_URL) } : env;
}

export default defineConfig(({ mode }) => ({
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    // Integration files share one Postgres and truncate it between tests; run files serially.
    fileParallelism: false,
    globalSetup: ['./tests/globalSetup.ts'],
    env: testEnv(loadEnv(mode, process.cwd(), '')),
    include: [
      'src/**/*.test.{ts,tsx}',
      'tests/integration/**/*.test.ts',
      'tests/helpers/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
      skipFull: false,
      thresholds: {
        lines: 60,
        'src/services/categorizer.ts': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
}));
