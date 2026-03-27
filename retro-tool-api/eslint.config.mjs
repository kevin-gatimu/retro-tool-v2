// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    files: ['src/**/*.service.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSTypeAliasDeclaration[id.name!='Database']",
          message:
            "Only the 'Database' type alias is allowed in service files. Move other types to a types folder (preferably common/types when shared).",
        },
        {
          selector: 'TSInterfaceDeclaration',
          message:
            'Interfaces are not allowed in service files. Move them to a types folder.',
        },
      ],
    },
  },
);
