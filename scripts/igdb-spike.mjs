#!/usr/bin/env node
/**
 * Spike da IGDB — item B-07 do backlog, marco M0.
 *
 * Mede, sobre uma amostra real do catálogo:
 *   - cobertura de cada campo de que o projeto depende;
 *   - quantos jogos sobrevivem ao critério indie provisório;
 *   - tamanho estimado do catálogo final;
 *   - disponibilidade de um indicador de interesse pré-lançamento.
 *
 * Produz:
 *   docs/m0-relatorio-igdb.md            relatório do M0
 *   scripts/out/fixtures/*.json          fixtures reais para os testes do B-10
 *
 * Uso:
 *   IGDB_CLIENT_ID=... IGDB_CLIENT_SECRET=... node scripts/igdb-spike.mjs
 *   node scripts/igdb-spike.mjs --max 5000 --fixtures 30
 *
 * Não tem dependências: roda com Node 22 puro.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------- argumentos

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const MAX_GAMES = Number(arg('max', 3000));
const FIXTURE_COUNT = Number(arg('fixtures', 25));
const PAGE_SIZE = 500;

// Publishers grandes, por nome normalizado. Lista provisória: o B-11 a
// transforma em config/indie-criteria.json depois de validada contra casos
// reais. Serve aqui só para medir quantos jogos o critério remove.
const MAJOR_PUBLISHERS = [
  'electronic arts', 'ea games', 'ubisoft', 'ubisoft entertainment',
  'activision', 'activision blizzard', 'blizzard entertainment',
  'take-two interactive', 'rockstar games', '2k games', '2k',
  'square enix', 'capcom', 'konami', 'bandai namco entertainment',
  'bandai namco games', 'sega', 'nintendo', 'sony interactive entertainment',
  'sony computer entertainment', 'microsoft game studios', 'xbox game studios',
  'bethesda softworks', 'zenimax media', 'warner bros. interactive entertainment',
  'tencent', 'netease', 'embracer group', 'thq nordic', 'koch media',
  'paradox interactive', 'focus entertainment', 'deep silver', 'krafton',
  'epic games', 'valve corporation', 'riot games', 'mihoyo', 'devolver digital', 'annapurna interactive',
];

// ------------------------------------------------------------------- cliente

async function getToken(clientId, clientSecret) {
  const url = new URL('https://id.twitch.tv/oauth2/token');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('grant_type', 'client_credentials');

  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Falha ao obter token da Twitch: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.access_token;
}

let lastCall = 0;
async function throttle() {
  // A IGDB aceita 4 requisições por segundo. 280ms deixa folga.
  const wait = 280 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

function makeClient(clientId, token) {
  return async function igdb(endpoint, query, attempt = 1) {
    await throttle();
    const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: query,
    });

    if (res.status === 429 && attempt <= 5) {
      const backoff = 500 * 2 ** attempt;
      console.warn(`  limite de taxa atingido, aguardando ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
      return igdb(endpoint, query, attempt + 1);
    }
    if (!res.ok) {
      throw new Error(`IGDB ${endpoint} ${res.status}: ${await res.text()}`);
    }
    return res.json();
  };
}

// -------------------------------------------------------------------- query

const FIELDS = [
  'id', 'name', 'slug', 'summary', 'storyline', 'url',
  'first_release_date', 'category', 'status',
  'genres.id', 'genres.name',
  'themes.id', 'themes.name',
  'keywords.id', 'keywords.name',
  'cover.image_id',
  'involved_companies.developer',
  'involved_companies.publisher',
  'involved_companies.company.id',
  'involved_companies.company.name',
  'involved_companies.company.country',
  'language_supports.language.id',
  'language_supports.language.name',
  'language_supports.language.locale',
  'language_supports.language_support_type',
  'websites.category', 'websites.url',
  'total_rating_count', 'rating_count', 'follows', 'hypes',
].join(',');

// Jogos principais, sem DLC, expansão, bundle ou porte, e sem versões
// alternativas do mesmo título.
const BASE_WHERE = 'category = 0 & version_parent = null';

// ------------------------------------------------------------------ métricas

const FIELD_CHECKS = {
  'Resumo (summary)': (g) => Boolean(g.summary && g.summary.trim().length >= 40),
  'Capa (cover.image_id)': (g) => Boolean(g.cover?.image_id),
  'Pelo menos um gênero': (g) => (g.genres?.length ?? 0) > 0,
  'Pelo menos um tema': (g) => (g.themes?.length ?? 0) > 0,
  'Pelo menos uma palavra-chave': (g) => (g.keywords?.length ?? 0) > 0,
  'Data de lançamento': (g) => Boolean(g.first_release_date),
  'Empresa envolvida': (g) => (g.involved_companies?.length ?? 0) > 0,
  'Desenvolvedora identificada': (g) => developers(g).length > 0,
  'País da desenvolvedora': (g) => developers(g).some((c) => c.company?.country != null),
  'Idiomas suportados': (g) => (g.language_supports?.length ?? 0) > 0,
  'Suporte a português': (g) =>
    (g.language_supports ?? []).some((l) => (l.language?.locale ?? '').toLowerCase().startsWith('pt')),
  'Link oficial (url ou website)': (g) => Boolean(g.url || (g.websites?.length ?? 0) > 0),
  'Contagem de avaliações > 0': (g) => (g.total_rating_count ?? 0) > 0,
  'Interesse pré-lançamento (hypes > 0)': (g) => (g.hypes ?? 0) > 0,
  'Seguidores (follows > 0)': (g) => (g.follows ?? 0) > 0,
};

function developers(g) {
  return (g.involved_companies ?? []).filter((c) => c.developer);
}
function publishers(g) {
  return (g.involved_companies ?? []).filter((c) => c.publisher);
}
function isMajorPublished(g) {
  return publishers(g).some((p) =>
    MAJOR_PUBLISHERS.includes((p.company?.name ?? '').trim().toLowerCase()),
  );
}
function hasIndieGenre(g) {
  // 32 = Indie na taxonomia de gêneros da IGDB.
  return (g.genres ?? []).some((x) => x.id === 32);
}

function pct(n, total) {
  if (!total) return '—';
  return `${((n / total) * 100).toFixed(1)}%`;
}

// ---------------------------------------------------------------------- main

async function loadEnv() {
  if (process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET) return;
  try {
    const raw = await readFile(resolve(ROOT, '.env'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* sem .env, segue com as variáveis do ambiente */
  }
}

async function main() {
  await loadEnv();
  const clientId = process.env.IGDB_CLIENT_ID;
  const clientSecret = process.env.IGDB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      'Faltam IGDB_CLIENT_ID e IGDB_CLIENT_SECRET.\n' +
        'Crie uma aplicação em https://dev.twitch.tv/console/apps (a conta precisa de 2FA)\n' +
        'e preencha as duas variáveis no .env ou no ambiente.',
    );
    process.exit(1);
  }

  console.log('Autenticando na Twitch...');
  const token = await getToken(clientId, clientSecret);
  const igdb = makeClient(clientId, token);

  console.log('Contando o catálogo...');
  const totalAll = (await igdb('games/count', `where ${BASE_WHERE};`)).count;
  const totalIndieGenre = (await igdb('games/count', `where ${BASE_WHERE} & genres = (32);`)).count;
  const totalUpcoming = (
    await igdb(
      'games/count',
      `where ${BASE_WHERE} & genres = (32) & first_release_date > ${Math.floor(Date.now() / 1000)};`,
    )
  ).count;

  console.log(`  jogos principais no total: ${totalAll}`);
  console.log(`  com gênero Indie: ${totalIndieGenre} (dos quais ${totalUpcoming} ainda não lançados)`);

  console.log(`Amostrando até ${MAX_GAMES} jogos com gênero Indie...`);
  const games = [];
  let lastId = 0;
  while (games.length < MAX_GAMES) {
    const page = await igdb(
      'games',
      `fields ${FIELDS}; where ${BASE_WHERE} & genres = (32) & id > ${lastId}; sort id asc; limit ${PAGE_SIZE};`,
    );
    if (page.length === 0) break;
    games.push(...page);
    lastId = page[page.length - 1].id;
    process.stdout.write(`\r  ${games.length} jogos`);
  }
  console.log('');

  const sample = games.slice(0, MAX_GAMES);
  const n = sample.length;

  // cobertura dos campos
  const coverage = Object.entries(FIELD_CHECKS).map(([label, check]) => {
    const hits = sample.filter(check).length;
    return { label, hits, pct: pct(hits, n) };
  });

  // critério indie provisório
  const removedByPublisher = sample.filter(isMajorPublished);
  const surviving = sample.filter((g) => !isMajorPublished(g));
  const ratio = n ? surviving.length / n : 0;
  const estimatedCatalog = Math.round(totalIndieGenre * ratio);

  // atributos de conteúdo por jogo (dimensiona o TF-IDF do B-12)
  const attrCounts = sample.map(
    (g) => (g.genres?.length ?? 0) + (g.themes?.length ?? 0) + (g.keywords?.length ?? 0),
  );
  const avgAttrs = attrCounts.reduce((a, b) => a + b, 0) / (n || 1);
  const distinctFeatures = new Set();
  for (const g of sample) {
    for (const x of g.genres ?? []) distinctFeatures.add(`GENRE:${x.id}`);
    for (const x of g.themes ?? []) distinctFeatures.add(`THEME:${x.id}`);
    for (const x of g.keywords ?? []) distinctFeatures.add(`KEYWORD:${x.id}`);
  }

  // países das desenvolvedoras
  const countries = new Map();
  for (const g of sample) {
    for (const d of developers(g)) {
      const c = d.company?.country;
      if (c != null) countries.set(c, (countries.get(c) ?? 0) + 1);
    }
  }
  const topCountries = [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  // portões do F-06
  const countryCoverage = coverage.find((c) => c.label === 'País da desenvolvedora');
  const langCoverage = coverage.find((c) => c.label === 'Idiomas suportados');
  const gate = (c) => (c && c.hits / n >= 0.5 ? 'APROVADO (segue P0)' : 'REPROVADO (vira P1)');

  // ------------------------------------------------------------- relatório
  const today = new Date().toISOString().slice(0, 10);
  const report = `# Relatório do marco M0 — viabilidade dos dados da IGDB

Gerado em ${today} pelo script \`scripts/igdb-spike.mjs\` (item B-07).
Amostra: **${n} jogos** com o gênero Indie, obtidos por paginação ordenada por id.

## 1. Tamanho do catálogo

| Medida | Valor |
| --- | --- |
| Jogos principais na IGDB (category = 0, sem versão pai) | ${totalAll} |
| Com o gênero Indie | ${totalIndieGenre} |
| Indie ainda não lançados | ${totalUpcoming} |
| Removidos pelo critério de publisher na amostra | ${removedByPublisher.length} (${pct(removedByPublisher.length, n)}) |
| **Estimativa do catálogo final** | **~${estimatedCatalog}** |

Premissa PR-06 (alguns milhares de jogos): ${estimatedCatalog <= 20000 ? 'sustentada' : 'NÃO sustentada — aplicar recorte por data de lançamento ou popularidade mínima'}.

## 2. Cobertura dos campos

| Campo | Jogos com o dado | Cobertura |
| --- | --- | --- |
${coverage.map((c) => `| ${c.label} | ${c.hits} | ${c.pct} |`).join('\n')}

## 3. Portão do F-06 (filtros de idioma e país)

| Filtro | Cobertura | Decisão |
| --- | --- | --- |
| País do estúdio | ${countryCoverage?.pct} | ${gate(countryCoverage)} |
| Idioma | ${langCoverage?.pct} | ${gate(langCoverage)} |

Regra: abaixo de 50% de cobertura, o filtro sai do P0 e vira P1 (B-21).

## 4. Atributos de conteúdo (dimensiona o B-12)

| Medida | Valor |
| --- | --- |
| Média de atributos por jogo (gêneros + temas + palavras-chave) | ${avgAttrs.toFixed(1)} |
| Atributos distintos na amostra | ${distinctFeatures.size} |

## 5. Países de desenvolvedora mais frequentes

Códigos ISO 3166-1 numéricos, como a IGDB devolve.

| Código | Jogos |
| --- | --- |
${topCountries.map(([c, q]) => `| ${c} | ${q} |`).join('\n') || '| — | — |'}

## 6. Indicador de popularidade

A fórmula da seção 12 usa \`p_j\`. Disponibilidade na amostra:

- \`total_rating_count\` presente em ${coverage.find((c) => c.label === 'Contagem de avaliações > 0')?.pct} dos jogos.
- \`hypes\` (interesse pré-lançamento) presente em ${coverage.find((c) => c.label === 'Interesse pré-lançamento (hypes > 0)')?.pct}.
- \`follows\` presente em ${coverage.find((c) => c.label === 'Seguidores (follows > 0)')?.pct}.

## 7. Pendências para fechar o M0 manualmente

- [ ] Ler e registrar os termos de uso vigentes da IGDB (confirma ou derruba a PR-04).
- [ ] Decidir o campo de \`p_j\` para jogos não lançados com base na seção 6.
- [ ] Revisar a lista provisória de publishers grandes e movê-la para \`config/indie-criteria.json\` (B-11).
- [ ] Conferir manualmente 20 jogos da amostra: o critério acerta? Registrar acertos e erros.
`;

  await mkdir(resolve(ROOT, 'docs'), { recursive: true });
  await writeFile(resolve(ROOT, 'docs/m0-relatorio-igdb.md'), report, 'utf8');

  const outDir = resolve(ROOT, 'scripts/out/fixtures');
  await mkdir(outDir, { recursive: true });
  await writeFile(
    resolve(outDir, 'igdb-games.sample.json'),
    JSON.stringify(sample.slice(0, FIXTURE_COUNT), null, 2),
    'utf8',
  );
  // casos difíceis: campos ausentes, que o mapeador do B-10 precisa tolerar
  const sparse = sample
    .filter((g) => !g.summary || !g.cover || developers(g).length === 0 || !g.language_supports)
    .slice(0, 10);
  await writeFile(
    resolve(outDir, 'igdb-games.sparse.json'),
    JSON.stringify(sparse, null, 2),
    'utf8',
  );
  await writeFile(
    resolve(outDir, 'igdb-games.major-publisher.json'),
    JSON.stringify(removedByPublisher.slice(0, 10), null, 2),
    'utf8',
  );

  console.log('\nPronto.');
  console.log('  docs/m0-relatorio-igdb.md');
  console.log(`  scripts/out/fixtures/ (${Math.min(FIXTURE_COUNT, n)} completos, ${sparse.length} incompletos, ${Math.min(10, removedByPublisher.length)} de publisher grande)`);
}

main().catch((err) => {
  console.error(`\nErro: ${err.message}`);
  process.exit(1);
});
