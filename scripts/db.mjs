#!/usr/bin/env node
/**
 * PostgreSQL local sem Docker — item B-04 do backlog.
 *
 * Usa os binários oficiais do PostgreSQL empacotados no `embedded-postgres`
 * (mesma versão principal do Neon) e os controla pelo `pg_ctl`, de modo que o
 * banco fica rodando em segundo plano até o `stop`.
 *
 * Uso:
 *   pnpm db:start     cria o cluster na primeira vez, sobe o servidor e o banco
 *   pnpm db:stop      desliga o servidor
 *   pnpm db:status    informa se o servidor está no ar
 *
 * Porta, usuário, senha e nome do banco vêm da DATABASE_URL do .env (ou do
 * .env.example, se não houver .env). Os dados ficam em .data/postgres.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_ROOT = resolve(ROOT, '.data');
const DATA_DIR = resolve(DATA_ROOT, 'postgres');
const LOG_FILE = resolve(DATA_ROOT, 'postgres.log');

// ------------------------------------------------------------- configuração

function databaseUrl() {
  if (!process.env.DATABASE_URL) {
    const envFile = [resolve(ROOT, '.env'), resolve(ROOT, '.env.example')].find(existsSync);
    if (envFile) process.loadEnvFile(envFile);
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não definida no .env.');

  const url = new URL(process.env.DATABASE_URL);
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error(`DATABASE_URL aponta para ${url.hostname}; o banco local só atende localhost.`);
  }
  return {
    port: Number(url.port || 5432),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
  };
}

// Os binários ficam no pacote da plataforma, dependência opcional do
// embedded-postgres; por isso são resolvidos a partir dele.
async function binaries() {
  const platform = process.platform === 'win32' ? 'windows' : process.platform;
  const name = `@embedded-postgres/${platform}-${process.arch}`;
  const fromEmbedded = createRequire(fileURLToPath(import.meta.resolve('embedded-postgres')));
  try {
    return await import(pathToFileURL(fromEmbedded.resolve(name)).href);
  } catch {
    throw new Error(`Binários do PostgreSQL não encontrados para ${name}. Rode pnpm install.`);
  }
}

// ------------------------------------------------------------------ comandos

// Mensagens do PostgreSQL em inglês: traduzidas, saem com acentos quebrados no
// terminal do Windows, que usa outra codificação.
const PG_ENV = { ...process.env, LANGUAGE: 'en' };

function run(bin, args) {
  // stdio herdado: o postgres iniciado pelo pg_ctl não pode prender pipes deste processo.
  return spawnSync(bin, args, { stdio: 'inherit', env: PG_ENV }).status;
}

function isRunning(bin) {
  return spawnSync(bin.pg_ctl, ['status', '-D', DATA_DIR], { stdio: 'ignore' }).status === 0;
}

function initCluster(bin, cfg) {
  console.log(`Criando o cluster em ${DATA_DIR}...`);
  mkdirSync(DATA_ROOT, { recursive: true });
  const pwFile = resolve(DATA_ROOT, '.pwfile');
  writeFileSync(pwFile, cfg.password);
  try {
    const status = run(bin.initdb, [
      '-D',
      DATA_DIR,
      '-U',
      cfg.user,
      `--pwfile=${pwFile}`,
      '--auth=scram-sha-256',
      '--encoding=UTF8',
      '--locale=C',
      '--no-instructions',
    ]);
    if (status !== 0) throw new Error('initdb falhou.');
  } finally {
    rmSync(pwFile, { force: true });
  }
}

async function ensureDatabase(cfg) {
  const client = new pg.Client({ ...cfg, host: 'localhost', database: 'postgres' });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      cfg.database,
    ]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${cfg.database.replace(/"/g, '""')}"`);
      console.log(`Banco "${cfg.database}" criado.`);
    }
  } finally {
    await client.end();
  }
}

async function start() {
  const cfg = databaseUrl();
  const bin = await binaries();
  if (!existsSync(resolve(DATA_DIR, 'PG_VERSION'))) initCluster(bin, cfg);

  if (isRunning(bin)) {
    console.log('PostgreSQL já está no ar.');
  } else {
    const status = run(bin.pg_ctl, [
      'start',
      '-D',
      DATA_DIR,
      '-l',
      LOG_FILE,
      '-w',
      '-o',
      `-p ${cfg.port} -c listen_addresses=localhost`,
    ]);
    if (status !== 0) {
      throw new Error(
        `O servidor não subiu. Veja ${LOG_FILE} (a porta ${cfg.port} pode estar ocupada).`,
      );
    }
  }
  await ensureDatabase(cfg);
  console.log(`PostgreSQL local em postgresql://${cfg.user}@localhost:${cfg.port}/${cfg.database}`);
}

async function stop() {
  const bin = await binaries();
  if (!existsSync(DATA_DIR) || !isRunning(bin)) {
    console.log('PostgreSQL não está no ar.');
    return;
  }
  if (run(bin.pg_ctl, ['stop', '-D', DATA_DIR, '-m', 'fast', '-w']) !== 0) {
    throw new Error('pg_ctl stop falhou.');
  }
}

async function status() {
  const bin = await binaries();
  const up = existsSync(DATA_DIR) && isRunning(bin);
  console.log(up ? 'PostgreSQL no ar.' : 'PostgreSQL parado.');
}

const commands = { start, stop, status };
const command = commands[process.argv[2]];

if (!command) {
  console.error('Uso: node scripts/db.mjs <start|stop|status>');
  process.exit(1);
}

command().catch((err) => {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
});
