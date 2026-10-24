import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Client } from 'pg';
import { rootEnvFile } from '../../src/config/env';
import { assertE2eDatabase, databaseName, e2eDatabaseUrl } from './e2e-database';

// Cria o banco dos e2e se faltar, aplica as migrations e aponta os testes para ele. Usa o pg
// direto porque o globalSetup do Jest não resolve os imports do cliente gerado pelo Prisma.
export default async function globalSetup() {
  if (!process.env.DATABASE_URL && existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const url = e2eDatabaseUrl(process.env);
  assertE2eDatabase(url, process.env.E2E_ALLOWED_HOST);

  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  maintenance.search = '';
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    const name = databaseName(url);
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [name]);
    if (rowCount === 0) await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
  } finally {
    await client.end();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
    shell: process.platform === 'win32',
  });
  process.env.DATABASE_URL = url;
}
