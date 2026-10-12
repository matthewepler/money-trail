import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'playwright-report/', 'test-results/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    plugins: { import: importPlugin },
    rules: {
      'import/no-default-export': 'error',
    },
  },
  {
    files: ['src/web/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // The client may depend on src/domain/ and nothing server-side (CLAUDE.md, Layering).
    files: ['src/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/server/**',
                '**/services/**',
                '**/repositories/**',
                '**/parsers/**',
                '**/providers/**',
                '**/db/**',
              ],
              message: 'The client may import from src/domain/ only.',
            },
          ],
        },
      ],
    },
  },
  {
    // fetch() is called in src/web/api/ and nowhere else.
    files: ['src/web/**/*.{ts,tsx}'],
    ignores: ['src/web/api/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Call the API through src/web/api/.' },
      ],
    },
  },
  {
    files: ['*.config.ts', '*.config.js', 'tests/e2e/support/globalSetup.ts'],
    rules: {
      'import/no-default-export': 'off',
    },
  },
  eslintConfigPrettier,
);
