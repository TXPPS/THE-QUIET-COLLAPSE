// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'public/**', 'assets/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly', Buffer: 'readonly', TextDecoder: 'readonly', TextEncoder: 'readonly' } },
  },
  {
    files: ['src/sw/**/*.js'],
    languageOptions: {
      globals: {
        self: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        __CACHE_NAME__: 'readonly',
        __PRECACHE__: 'readonly',
      },
    },
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      // Coding standards from the master prompt: small files, shallow nesting, no unused code.
      'max-lines': ['warn', { max: 420, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 4],
      'max-params': ['warn', 9],
      complexity: ['warn', 24],
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
);
