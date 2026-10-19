import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'prisma/config';

// O .env fica na raiz do monorrepositório; os comandos do Prisma rodam em apps/api.
const rootEnv = resolve(process.cwd(), '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `generate` não precisa da URL; migrate e seed falham com mensagem clara se faltar.
    url: process.env.DATABASE_URL ?? '',
  },
});
