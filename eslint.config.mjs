import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Sem o bloco TypeScript e o parser do eslint-config-next: duplicariam o plugin do
// typescript-eslint e desligariam as regras com informação de tipos no frontend.
const nextRules = nextVitals
  .filter((config) => config.name !== 'next/typescript')
  .map((config) => {
    if (!config.languageOptions) return config;
    const languageOptions = { ...config.languageOptions };
    delete languageOptions.parser;
    return { ...config, languageOptions };
  });

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/.next/**',
    '**/generated/**',
    '**/coverage/**',
    '**/next-env.d.ts',
    'scripts/out/**',
  ]),

  js.configs.recommended,

  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs', 'apps/api/jest*.config.js'],
    languageOptions: { sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },

  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [nextRules],
    settings: { next: { rootDir: 'apps/web' }, react: { version: '19' } },
  },

  // Precisa ser o último.
  prettier,
]);
