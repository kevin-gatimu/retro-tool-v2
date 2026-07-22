// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Real lint gate for the Convex functions (was a console.log stub — V14).
// Kept dependency-light: recommended rules without type-aware linting, since
// type safety is enforced separately by `pnpm type-check` (tsc against
// convex/tsconfig.json, with the committed _generated types).
export default tseslint.config(
  {
    ignores: ['convex/_generated/**', 'eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['convex/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
