import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Do eslint-config-next aproveitamos as regras de Next, React, hooks e jsx-a11y.
// O bloco TypeScript dele e o parser próprio ficam de fora: o typescript-eslint
// abaixo já cobre o TypeScript, com informação de tipos.
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

  // Regras com informação de tipos (ex.: promessa sem await) em todo o TypeScript.
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
  },

  // Arquivos JavaScript de configuração e scripts rodam no Node, sem tsconfig.
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs', 'apps/api/jest.config.js'],
    languageOptions: { sourceType: 'commonjs' },
  },

  // Frontend: regras do Next.js, React, hooks e acessibilidade (RNF-05).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [nextRules],
    settings: { next: { rootDir: 'apps/web' }, react: { version: '19' } },
  },

  // Desliga regras de estilo que conflitam com o Prettier; precisa ser o último.
  prettier,
]);
