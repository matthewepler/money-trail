import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => ({
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    env: loadEnv(mode, process.cwd(), ''),
    include: ['src/**/*.test.{ts,tsx}', 'tests/integration/**/*.test.ts'],
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
