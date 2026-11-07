import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiEnvSchema, parseEnv, rootEnvFile } from './config/env';
import { validateIngestionEnv } from './config/ingestion-env';
import { FeatureType } from './generated/prisma/client';
import { IgdbClient } from './modules/ingestion/igdb/igdb.client';
import { SteamStoreClient, type SteamTag } from './modules/tags/steam-store.client';
import {
  evidenceAgreement,
  fallbackMatcher,
  readTagVocabulary,
  relevantTags,
  TAG_DRAFT_FILE,
  type TagVocabulary,
} from './modules/tags/tags';
import { PrismaService } from './prisma/prisma.service';

// Medição das etiquetas da comunidade Steam (B-77), só leitura no banco. A coleta busca o id da
// Steam de cada jogo do catálogo na IGDB (external_games, fonte 1) e as etiquetas na loja, e grava
// tudo num cache fora do repositório: os termos da Web API permitem mostrar os dados aos usuários,
// não redistribuí-los. O relatório lê o cache, o banco e o rascunho do vocabulário.
//
//   tsx src/measure-tags.ts --cache <pasta> [--offline] [--skeleton <arquivo>] > relatorio.md

const STEAM_SOURCE = 1;
const GAMES_PER_IGDB_QUERY = 200;
const MIN_RELATIVE_WEIGHTS = [0.1, 0.2, 0.3, 0.5];
const MIN_CATALOG_GAMES = 3;
const SAMPLE_SEED = 77;
const SAMPLE_SIZE = 30;
const MIN_AGREEMENT_GAMES = 5;

interface SteamCache {
  fetchedAt: string;
  appidsByIgdbId: Record<string, number[]>;
  tagsByAppid: Record<string, SteamTag[]>;
  names: { brazilian: Record<string, string>; english: Record<string, string> };
}

interface CatalogGame {
  igdbId: number;
  slug: string;
  name: string;
  summary: string;
  popularityCount: number;
  keywords: string[];
}

interface MeasuredGame extends CatalogGame {
  appid: number | null;
  appids: number;
  tags: SteamTag[];
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name: string) => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
  };
  const cacheDir = option('--cache');
  if (!cacheDir) throw new Error('Informe a pasta do cache com --cache <pasta>.');
  const cacheFile = join(cacheDir, 'steam-tags.json');

  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const { DATABASE_URL } = parseEnv(apiEnvSchema.pick({ DATABASE_URL: true }), process.env);
  const prisma = new PrismaService(DATABASE_URL);
  try {
    const catalog = await loadCatalog(prisma);
    if (!args.includes('--offline')) {
      writeFileSync(cacheFile, JSON.stringify(await collect(catalog)));
      console.error(`Cache gravado em ${cacheFile}`);
    }
    const cache = JSON.parse(readFileSync(cacheFile, 'utf8')) as SteamCache;
    const games = measured(catalog, cache);

    const skeleton = option('--skeleton');
    if (skeleton) {
      writeFileSync(skeleton, JSON.stringify(tagFrequencies(games, cache), null, 2));
      console.error(`Lista de etiquetas gravada em ${skeleton}`);
    }
    const vocabulary = existsSync(TAG_DRAFT_FILE) ? readTagVocabulary() : null;
    console.log(report(games, cache, vocabulary).join('\n'));
  } finally {
    await prisma.$disconnect();
  }
}

async function loadCatalog(prisma: PrismaService): Promise<CatalogGame[]> {
  const rows = await prisma.game.findMany({
    where: { inCatalog: true },
    orderBy: { igdbId: 'asc' },
    select: {
      igdbId: true,
      slug: true,
      name: true,
      summary: true,
      popularityCount: true,
      features: {
        where: { feature: { type: FeatureType.KEYWORD } },
        select: { feature: { select: { slug: true } } },
      },
    },
  });
  return rows.map(({ features, ...game }) => ({
    ...game,
    keywords: features.map(({ feature }) => feature.slug),
  }));
}

async function collect(catalog: readonly CatalogGame[]): Promise<SteamCache> {
  const env = validateIngestionEnv(process.env);
  const igdb = new IgdbClient({
    credentials: { clientId: env.IGDB_CLIENT_ID, clientSecret: env.IGDB_CLIENT_SECRET },
  });
  const appidsByIgdbId: Record<string, number[]> = {};
  for (let start = 0; start < catalog.length; start += GAMES_PER_IGDB_QUERY) {
    const ids = catalog.slice(start, start + GAMES_PER_IGDB_QUERY).map((g) => g.igdbId);
    const rows = (await igdb.query(
      'external_games',
      `fields game,uid; where game = (${ids.join(',')}) & external_game_source = ${STEAM_SOURCE}; limit 500;`,
    )) as { game?: number; uid?: string }[];
    for (const { game, uid } of rows) {
      if (game === undefined || !uid || !/^\d+$/.test(uid)) continue;
      (appidsByIgdbId[game] ??= []).push(Number(uid));
    }
    console.error(`IGDB: ${Math.min(start + GAMES_PER_IGDB_QUERY, catalog.length)} jogos`);
  }

  const steam = new SteamStoreClient();
  const appids = [...new Set(Object.values(appidsByIgdbId).flat())].sort((a, b) => a - b);
  console.error(`Steam: ${appids.length} ids`);
  const tags = await steam.tagsOf(appids);
  const names = async (language: 'brazilian' | 'english') =>
    Object.fromEntries([...(await steam.tagNames(language))].map(([id, name]) => [id, name]));
  return {
    fetchedAt: new Date().toISOString(),
    appidsByIgdbId,
    tagsByAppid: Object.fromEntries(tags),
    names: { brazilian: await names('brazilian'), english: await names('english') },
  };
}

// Com mais de um id da Steam (edições, relançamentos), fica o primeiro que tem etiquetas, na
// ordem numérica: o id mais antigo costuma ser o do jogo original.
function measured(catalog: readonly CatalogGame[], cache: SteamCache): MeasuredGame[] {
  return catalog.map((game) => {
    const appids = [...(cache.appidsByIgdbId[game.igdbId] ?? [])].sort((a, b) => a - b);
    const appid = appids.find((id) => cache.tagsByAppid[id]?.length) ?? appids[0] ?? null;
    return {
      ...game,
      appid,
      appids: appids.length,
      tags: appid === null ? [] : (cache.tagsByAppid[appid] ?? []),
    };
  });
}

function tagFrequencies(games: readonly MeasuredGame[], cache: SteamCache) {
  const count = new Map<number, number>();
  for (const game of games) {
    for (const { tagid } of relevantTags(game.tags, MIN_RELATIVE_WEIGHTS[0]!)) {
      count.set(tagid, (count.get(tagid) ?? 0) + 1);
    }
  }
  return [...count]
    .filter(([, n]) => n >= MIN_CATALOG_GAMES)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([id, catalogGames]) => ({
      id,
      name: cache.names.brazilian[id] ?? String(id),
      englishName: cache.names.english[id] ?? String(id),
      catalogGames,
    }));
}

function report(
  games: readonly MeasuredGame[],
  cache: SteamCache,
  vocabulary: TagVocabulary | null,
): string[] {
  const out: string[] = [];
  const total = games.length;
  const withAppid = games.filter((g) => g.appid !== null);
  const withTags = games.filter((g) => g.tags.length > 0);
  const accepted = vocabulary
    ? new Set(vocabulary.tags.filter((t) => t.accepted).map((t) => t.id))
    : null;
  const acceptedOf = (game: MeasuredGame, x: number) =>
    relevantTags(game.tags, x).filter((t) => accepted === null || accepted.has(t.tagid));
  const name = (id: number) => cache.names.brazilian[id] ?? String(id);

  out.push('# Medição das etiquetas da comunidade Steam (B-77)', '');
  out.push(
    `Catálogo do banco local: ${total} jogos com inCatalog. Coleta em ${cache.fetchedAt.slice(0, 10)}. Vocabulário: ${vocabulary ? `${accepted!.size} etiquetas aceitas de ${vocabulary.tags.length}` : 'ainda sem rascunho (todas as etiquetas contam)'}.`,
    '',
  );

  out.push('## 1. Coleta', '');
  out.push('| Medida | Jogos |', '| --- | --- |');
  out.push(`| Com id da Steam na IGDB | ${count(withAppid.length, total)} |`);
  out.push(
    `| Com mais de um id da Steam | ${count(games.filter((g) => g.appids > 1).length, total)} |`,
  );
  out.push(`| Com etiquetas na Steam | ${count(withTags.length, total)} |`, '');

  const quartiles = popularityQuartiles(games);
  out.push('## 2. Cobertura por peso mínimo relativo e por quartil de popularidade', '');
  out.push(
    'Jogos com ao menos uma etiqueta aceita. O quartil 1 é o menos popular. Mediana de etiquetas aceitas entre os jogos que têm alguma.',
    '',
  );
  out.push(
    '| Peso mínimo | Catálogo | Quartil 1 | Quartil 2 | Quartil 3 | Quartil 4 | Mediana por jogo |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const x of MIN_RELATIVE_WEIGHTS) {
    const covered = (list: readonly MeasuredGame[]) =>
      list.filter((g) => acceptedOf(g, x).length > 0);
    const sizes = covered(games).map((g) => acceptedOf(g, x).length);
    out.push(
      `| ${x} | ${count(covered(games).length, total)} | ${quartiles
        .map((q) => percent(covered(q).length, q.length))
        .join(' | ')} | ${median(sizes)} |`,
    );
  }
  out.push('');

  out.push('## 3. Recortes de vetor pobre (peso mínimo 0,1)', '');
  out.push('| Recorte | Jogos | Com etiqueta aceita |', '| --- | --- | --- |');
  for (const [label, list] of [
    ['Sem palavras-chave na IGDB', games.filter((g) => g.keywords.length === 0)],
    ['Até 2 palavras-chave na IGDB', games.filter((g) => g.keywords.length <= 2)],
  ] as const) {
    const covered = list.filter((g) => acceptedOf(g, 0.1).length > 0).length;
    out.push(`| ${label} | ${list.length} | ${count(covered, list.length)} |`);
  }
  out.push('');

  if (vocabulary) {
    const match = fallbackMatcher(vocabulary);
    const steamless = games.filter((g) => acceptedOf(g, 0.1).length === 0);
    const fallbackCovered = steamless.filter((g) => match(g).length > 0).length;
    out.push('## 4. Reserva da IGDB', '');
    out.push(
      `Nos ${steamless.length} jogos sem etiqueta aceita da Steam, ${count(fallbackCovered, steamless.length)} ganham ao menos uma etiqueta pelas palavras-chave ou pelo resumo.`,
      '',
    );
    const agreement = evidenceAgreement(
      withTags.map((g) => ({
        matches: match(g),
        steamTags: new Set(relevantTags(g.tags, 0.1).map((t) => t.tagid)),
      })),
    ).filter((row) => row.games >= MIN_AGREEMENT_GAMES);
    out.push(
      `Concordância da evidência da IGDB com a Steam, nos jogos com as duas fontes (evidências com ao menos ${MIN_AGREEMENT_GAMES} jogos), da menor para a maior:`,
      '',
    );
    out.push('| Evidência | Etiqueta | Jogos | Confirmados |', '| --- | --- | --- | --- |');
    for (const row of agreement) {
      out.push(
        `| ${row.term} | ${name(row.tagid)} | ${row.games} | ${percent(row.confirmed, row.games)} |`,
      );
    }
    out.push('');
  }

  out.push(`## 5. Amostra de precisão (semente ${SAMPLE_SEED}, peso mínimo 0,1)`, '');
  const sample = seededSample(withTags, SAMPLE_SIZE, SAMPLE_SEED);
  out.push('| Jogo | Etiquetas aceitas (peso relativo) |', '| --- | --- |');
  for (const game of sample) {
    out.push(
      `| ${game.name} (${game.slug}) | ${acceptedOf(game, 0.1)
        .map((t) => `${name(t.tagid)} (${t.relative.toFixed(2)})`)
        .join(', ')} |`,
    );
  }
  return out;
}

function popularityQuartiles(games: readonly MeasuredGame[]) {
  const sorted = [...games].sort(
    (a, b) => a.popularityCount - b.popularityCount || a.igdbId - b.igdbId,
  );
  const size = Math.ceil(sorted.length / 4);
  return [0, 1, 2, 3].map((q) => sorted.slice(q * size, (q + 1) * size));
}

export function seededSample<T>(items: readonly T[], size: number, seed: number): T[] {
  const random = mulberry32(seed);
  const picked = new Set<number>();
  while (picked.size < Math.min(size, items.length)) {
    picked.add(Math.floor(random() * items.length));
  }
  return [...picked].map((i) => items[i]!);
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function median(values: readonly number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function percent(part: number, whole: number) {
  return whole === 0 ? '—' : `${((100 * part) / whole).toFixed(1).replace('.', ',')}%`;
}

function count(part: number, whole: number) {
  return `${part.toLocaleString('pt-BR')} (${percent(part, whole)})`;
}

void main();
