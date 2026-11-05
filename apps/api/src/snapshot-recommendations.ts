import 'reflect-metadata';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { apiEnvSchema, parseEnv, rootEnvFile } from './config/env';
import { DiscoveryMode, FeatureType } from './generated/prisma/client';
import { FeatureLabels } from './modules/catalog/feature-labels';
import { ContentIndexService } from './modules/recommendation/content-index.service';
import {
  GenerateRecommendationsUseCase,
  SCORING_CONFIG,
} from './modules/recommendation/generate-recommendations.use-case';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import type { ScoringConfig } from './modules/recommendation/scoring/scoring-config';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';

// Foto das respostas de recomendação para conferir que uma mudança não altera nenhuma: a visão geral
// e o "ver mais" de cada lista, nos três modos, em 400 perfis da semente 71 (200 com quatro jogos
// avaliados com 5, 5, 4 e 1 e 200 com três gêneros ou temas preferidos), como nas medições do B-33
// ao B-74. Grava o hash do JSON de cada resposta; `--compare` aponta as diferenças entre duas fotos.
//
//   node dist/snapshot-recommendations.js <saída.json> [--quick]
//   node dist/snapshot-recommendations.js --compare <antes.json> <depois.json>
//
// Completa: todas as páginas de cada lista. Rápida (--quick): a primeira e a última.

const SEED = 71;
const PROFILES_PER_KIND = 200;
const RATED_SCORES = [5, 5, 4, 1];
const PREFERENCES_PER_PROFILE = 3;
const EMAIL_PREFIX = 'snapshot-recomendacoes-';
const MODES = [DiscoveryMode.POPULAR, DiscoveryMode.BALANCED, DiscoveryMode.DISCOVERY];
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export interface SnapshotEntry {
  profile: number;
  mode: DiscoveryMode;
  key: string | null;
  page: number | null;
  status: number;
  hash: string;
}

export interface Snapshot {
  scope: 'full' | 'quick';
  entries: SnapshotEntry[];
}

// A foto cria e apaga contas: como os e2e, só roda em banco local.
export function assertLocalDatabase(databaseUrl: string) {
  const { hostname } = new URL(databaseUrl);
  if (!LOCAL_HOSTS.has(hostname)) {
    throw new Error(`A foto das recomendações só roda em banco local; o host é "${hostname}".`);
  }
}

// O desempate depende do id do usuário: o mesmo perfil precisa do mesmo id em toda execução.
export function profileUserId(profile: number) {
  const hex = createHash('sha256').update(`${EMAIL_PREFIX}${SEED}:${profile}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sample<T>(random: () => number, items: readonly T[], count: number): T[] {
  const picked = new Set<T>();
  while (picked.size < count) picked.add(items[Math.floor(random() * items.length)]!);
  return [...picked];
}

// Só o que está no snapshot de cada lado; uma foto rápida é comparada com as entradas dela.
export function compareSnapshots(before: Snapshot, after: Snapshot) {
  const keyOf = (e: SnapshotEntry) => `${e.profile}|${e.mode}|${e.key}|${e.page}`;
  const reference = new Map(before.entries.map((e) => [keyOf(e), e]));
  const missing: string[] = [];
  const different: string[] = [];
  for (const entry of after.entries) {
    const previous = reference.get(keyOf(entry));
    if (!previous) missing.push(keyOf(entry));
    else if (previous.status !== entry.status || previous.hash !== entry.hash) {
      different.push(keyOf(entry));
    }
  }
  return { compared: after.entries.length - missing.length, missing, different };
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvFile,
      validate: (env) => parseEnv(apiEnvSchema.pick({ DATABASE_URL: true }), env),
    }),
    PrismaModule,
    RecommendationModule,
  ],
})
class SnapshotModule {}

async function createProfiles(prisma: PrismaService, labels: FeatureLabels) {
  const games = (
    await prisma.game.findMany({
      where: { inCatalog: true },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
  ).map(({ id }) => id);
  const features = (
    await prisma.feature.findMany({
      where: { type: { in: [FeatureType.GENRE, FeatureType.THEME] }, idf: { gt: 0 } },
      select: { id: true, type: true, slug: true },
      orderBy: [{ type: 'asc' }, { igdbId: 'asc' }],
    })
  ).filter(({ type, slug }) => !labels.isHidden(type as 'GENRE' | 'THEME', slug));

  const random = mulberry32(SEED);
  const rated = Array.from({ length: PROFILES_PER_KIND }, () =>
    sample(random, games, RATED_SCORES.length),
  );
  const preferred = Array.from({ length: PROFILES_PER_KIND }, () =>
    sample(random, features, PREFERENCES_PER_PROFILE).map(({ id }) => id),
  );

  await deleteProfiles(prisma);
  const profiles = [...rated, ...preferred].map((_, i) => ({
    id: profileUserId(i),
    email: `${EMAIL_PREFIX}${i}@example.com`,
    passwordHash: 'x',
    displayName: 'Foto das recomendações',
  }));
  await prisma.user.createMany({ data: profiles });
  await prisma.rating.createMany({
    data: rated.flatMap((gameIds, i) =>
      gameIds.map((gameId, j) => ({ userId: profileUserId(i), gameId, score: RATED_SCORES[j]! })),
    ),
  });
  await prisma.userPreference.createMany({
    data: preferred.flatMap((featureIds, i) =>
      featureIds.map((featureId) => ({ userId: profileUserId(PROFILES_PER_KIND + i), featureId })),
    ),
  });
  return profiles.length;
}

function deleteProfiles(prisma: PrismaService) {
  return prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
}

async function take(call: () => Promise<unknown>): Promise<{ status: number; body: unknown }> {
  try {
    return { status: 200, body: await call() };
  } catch (error) {
    const status = (error as { getStatus?: () => number }).getStatus?.();
    if (status === undefined) throw error;
    return { status, body: (error as Error).message };
  }
}

const hashOf = (body: unknown) => createHash('sha256').update(JSON.stringify(body)).digest('hex');

async function snapshot(out: string, scope: Snapshot['scope']) {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const { DATABASE_URL } = parseEnv(apiEnvSchema.pick({ DATABASE_URL: true }), process.env);
  assertLocalDatabase(DATABASE_URL);

  const app = await NestFactory.createApplicationContext(SnapshotModule, { logger: ['error'] });
  const prisma = app.get(PrismaService);
  try {
    const contentIndex = app.get(ContentIndexService);
    await contentIndex.settled();
    if (!contentIndex.index) throw new Error('O índice de conteúdo não carregou.');
    const recommendations = app.get(GenerateRecommendationsUseCase);
    const { lists } = app.get<ScoringConfig>(SCORING_CONFIG);
    const profiles = await createProfiles(prisma, app.get(FeatureLabels));

    const entries: SnapshotEntry[] = [];
    for (let profile = 0; profile < profiles; profile++) {
      const userId = profileUserId(profile);
      for (const mode of MODES) {
        const overview = await take(() => recommendations.overview(userId, mode));
        entries.push({ profile, mode, key: null, page: null, ...result(overview) });
        const shelves = (overview.body as { shelves?: { key: string }[] }).shelves ?? [];
        for (const key of new Set(['main', 'upcoming', ...shelves.map((s) => s.key)])) {
          const lastPage = Math.ceil(
            (key === 'main' ? lists.mainCap : lists.shelfCap) / lists.pageSize,
          );
          const page = (n: number) => take(() => recommendations.page(userId, mode, key, n));
          const pages = new Map<number, Awaited<ReturnType<typeof page>>>();
          if (scope === 'full') {
            for (let n = 1; n <= lastPage; n++) {
              const response = await page(n);
              pages.set(n, response);
              if (!(response.body as { hasMore?: boolean }).hasMore) break;
            }
          } else {
            pages.set(1, await page(1));
            for (let n = lastPage; n > 1; n--) {
              const response = await page(n);
              if ((response.body as { items?: unknown[] }).items?.length) {
                pages.set(n, response);
                break;
              }
            }
          }
          for (const [n, response] of pages) {
            entries.push({ profile, mode, key, page: n, ...result(response) });
          }
        }
      }
    }
    const total = createHash('sha256')
      .update(entries.map((e) => `${e.status}:${e.hash}`).join('\n'))
      .digest('hex');
    writeFileSync(out, JSON.stringify({ scope, entries } satisfies Snapshot));
    console.log(`${entries.length} respostas de ${profiles} perfis (${scope}); hash ${total}`);
  } finally {
    await deleteProfiles(prisma).catch(() => undefined);
    await app.close();
  }
}

function result({ status, body }: { status: number; body: unknown }) {
  return { status, hash: hashOf(body) };
}

function compare(beforeFile: string, afterFile: string) {
  const read = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
  const { compared, missing, different } = compareSnapshots(read(beforeFile), read(afterFile));
  console.log(
    `${compared} respostas comparadas; ${different.length} diferentes; ${missing.length} sem par`,
  );
  for (const key of [...different, ...missing].slice(0, 10)) console.log(`  ${key}`);
  process.exitCode = different.length + missing.length === 0 ? 0 : 1;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === '--compare') compare(args[1]!, args[2]!);
  else void snapshot(args[0] ?? 'snapshot.json', args.includes('--quick') ? 'quick' : 'full');
}
