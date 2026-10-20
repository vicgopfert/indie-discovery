#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURES_DIR = resolve(ROOT, 'apps/api/test/fixtures/igdb');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const MAX_GAMES = Number(arg('max', Infinity));
const PRIMITIVE_SAMPLE = Number(arg('primitives', 3000));
const PAGE_SIZE = 500;

// Lista provisória, só para medir remoções; a definitiva é do B-11.
const MAJOR_PUBLISHERS = [
  'electronic arts',
  'ea games',
  'ubisoft',
  'ubisoft entertainment',
  'activision',
  'activision blizzard',
  'blizzard entertainment',
  'take-two interactive',
  'rockstar games',
  '2k games',
  '2k',
  'square enix',
  'capcom',
  'konami',
  'bandai namco entertainment',
  'bandai namco games',
  'sega',
  'nintendo',
  'sony interactive entertainment',
  'sony computer entertainment',
  'microsoft game studios',
  'xbox game studios',
  'bethesda softworks',
  'zenimax media',
  'warner bros. interactive entertainment',
  'tencent',
  'netease',
  'embracer group',
  'thq nordic',
  'koch media',
  'paradox interactive',
  'focus entertainment',
  'deep silver',
  'krafton',
  'epic games',
  'valve corporation',
  'riot games',
  'mihoyo',
  'devolver digital',
  'annapurna interactive',
];

// Valores das tabelas de enumeração da IGDB (game_types, game_statuses,
// website_types, genres), conferidos em outubro de 2026.
const MAIN_GAME_TYPE = 0;
const CANCELLED_STATUS = 6;
const INDIE_GENRE = 32;
const EROTIC_THEME = 42;
const OFFICIAL_SITE_TYPE = 1;
const STORE_SITE_TYPES = [13, 15, 16, 17]; // Steam, itch.io, Epic, GOG

const SINCE_2015 = Date.UTC(2015, 0, 1) / 1000;

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

    if ((res.status === 429 || res.status >= 500) && attempt <= 5) {
      const backoff = 500 * 2 ** attempt;
      console.warn(`\n  IGDB respondeu ${res.status}, nova tentativa em ${backoff}ms`);
      await new Promise((r) => setTimeout(r, backoff));
      return igdb(endpoint, query, attempt + 1);
    }
    if (!res.ok) {
      throw new Error(`IGDB ${endpoint} ${res.status}: ${await res.text()}`);
    }
    return res.json();
  };
}

const FIELDS = [
  'id',
  'name',
  'slug',
  'summary',
  'storyline',
  'url',
  'first_release_date',
  'game_type',
  'game_status',
  'genres.id',
  'genres.name',
  'themes.id',
  'themes.name',
  'keywords.id',
  'keywords.name',
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
  'websites.type',
  'websites.url',
  'total_rating_count',
  'rating_count',
  'hypes',
].join(',');

// Jogos principais (sem DLC, expansão, bundle, porte, remake etc.) e sem
// versões alternativas do mesmo título, com o gênero Indie.
const BASE_WHERE = `game_type = ${MAIN_GAME_TYPE} & version_parent = null`;
const INDIE_WHERE = `${BASE_WHERE} & genres = (${INDIE_GENRE})`;

function developers(g) {
  return (g.involved_companies ?? []).filter((c) => c.developer);
}

function majorPublishers(g) {
  return (g.involved_companies ?? [])
    .filter((c) => c.publisher)
    .map((c) => (c.company?.name ?? '').trim().toLowerCase())
    .filter((name) => MAJOR_PUBLISHERS.includes(name));
}

// Resumo de cada jogo com só o que as métricas usam: o censo inteiro cabe em
// memória sem guardar as respostas completas da API.
function profile(g, now) {
  const date = g.first_release_date ?? null;
  const devs = developers(g);
  const sites = g.websites ?? [];
  const langs = g.language_supports ?? [];
  const genres = (g.genres ?? []).filter((x) => x.id !== INDIE_GENRE);

  return {
    id: g.id,
    date,
    upcoming: date != null && date > now,
    cancelled: g.game_status === CANCELLED_STATUS,
    erotic: (g.themes ?? []).some((x) => x.id === EROTIC_THEME),
    summary: Boolean(g.summary && g.summary.trim().length >= 40),
    cover: Boolean(g.cover?.image_id),
    genres: genres.length,
    themes: (g.themes ?? []).length,
    keywords: (g.keywords ?? []).length,
    features: [
      ...genres.map((x) => `G${x.id}`),
      ...(g.themes ?? []).map((x) => `T${x.id}`),
      ...(g.keywords ?? []).map((x) => `K${x.id}`),
    ],
    developer: devs.length > 0,
    country: devs.some((c) => c.company?.country != null),
    countries: [...new Set(devs.map((c) => c.company?.country).filter((c) => c != null))],
    languages: langs.length > 0,
    portuguese: langs.some((l) => (l.language?.locale ?? '').toLowerCase().startsWith('pt')),
    officialSite: sites.some((s) => s.type === OFFICIAL_SITE_TYPE),
    storeLink: sites.some((s) => STORE_SITE_TYPES.includes(s.type)),
    ratings: g.total_rating_count ?? 0,
    hypes: g.hypes ?? 0,
    major: majorPublishers(g),
  };
}

const RECORTES = [
  {
    id: 'R0',
    label: 'Todos os indie, sem publisher grande',
    test: (p) => p.major.length === 0,
  },
  {
    id: 'R1',
    label: 'R0 com capa, resumo e ao menos um gênero ou tema além de Indie',
    test: (p) => p.major.length === 0 && p.cover && p.summary && p.genres + p.themes > 0,
  },
  {
    id: 'R2',
    label: 'R1 com algum sinal de interesse: avaliações, hypes ou lançamento futuro',
    test: (p) => RECORTES[1].test(p) && (p.ratings > 0 || p.hypes > 0 || p.upcoming),
  },
  {
    id: 'R3',
    label: 'R2 sem cancelados, lançado desde 2015 ou com lançamento futuro',
    test: (p) =>
      RECORTES[2].test(p) &&
      !p.cancelled &&
      (p.upcoming || (p.date != null && p.date >= SINCE_2015)),
  },
  {
    id: 'R4',
    label:
      'R1 sem cancelados e sem o tema Erotic; lançado antes de 2015 com avaliações, lançado desde 2015 com avaliações ou hypes, com lançamento futuro, ou anunciado sem data com hypes',
    test: (p) =>
      RECORTES[1].test(p) &&
      !p.cancelled &&
      !p.erotic &&
      (p.upcoming ||
        (p.date == null && p.hypes > 0) ||
        (p.date != null && p.date < SINCE_2015 && p.ratings > 0) ||
        (p.date != null && p.date >= SINCE_2015 && (p.ratings > 0 || p.hypes > 0))),
  },
];

// Recorte aprovado no M0 (relatório, seção 8).
const FINAL = 'R4';

const FIELD_CHECKS = {
  'Resumo (≥ 40 caracteres)': (p) => p.summary,
  Capa: (p) => p.cover,
  'Gênero além de Indie': (p) => p.genres > 0,
  'Pelo menos um tema': (p) => p.themes > 0,
  'Pelo menos uma palavra-chave': (p) => p.keywords > 0,
  'Data de lançamento': (p) => p.date != null,
  'Desenvolvedora identificada': (p) => p.developer,
  'País da desenvolvedora': (p) => p.country,
  'Idiomas suportados': (p) => p.languages,
  'Suporte a português': (p) => p.portuguese,
  'Site oficial (website tipo 1)': (p) => p.officialSite,
  'Link de loja (Steam, itch.io, Epic, GOG)': (p) => p.storeLink,
  'Site oficial ou loja': (p) => p.officialSite || p.storeLink,
  'Avaliações (total_rating_count > 0)': (p) => p.ratings > 0,
  'Interesse pré-lançamento (hypes > 0)': (p) => p.hypes > 0,
};

function pct(n, total) {
  if (!total) return '—';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function fmt(n) {
  return n.toLocaleString('pt-BR');
}

// Escolhe até `count` itens espalhados pela lista, em vez dos primeiros (ids
// baixos são jogos cadastrados há mais tempo e enviesariam a amostra).
function spread(list, count) {
  if (list.length <= count) return list;
  const step = list.length / count;
  return Array.from({ length: count }, (_, i) => list[Math.floor(i * step)]);
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function census(igdb, now) {
  const profiles = [];
  let lastId = 0;
  while (profiles.length < MAX_GAMES) {
    const page = await igdb(
      'games',
      `fields ${FIELDS}; where ${INDIE_WHERE} & id > ${lastId}; sort id asc; limit ${PAGE_SIZE};`,
    );
    if (page.length === 0) break;
    for (const g of page) profiles.push(profile(g, now));
    lastId = page[page.length - 1].id;
    process.stdout.write(`\r  ${fmt(profiles.length)} jogos`);
  }
  console.log('');
  return profiles.slice(0, MAX_GAMES);
}

async function primitivesCoverage(igdb, games) {
  const types = await igdb('popularity_types', 'fields id,name,popularity_source; limit 100;');
  const seen = new Map(types.map((t) => [t.id, new Set()]));

  for (const ids of chunk(
    games.map((g) => g.id),
    100,
  )) {
    let offset = 0;
    for (;;) {
      const rows = await igdb(
        'popularity_primitives',
        `fields game_id,popularity_type; where game_id = (${ids.join(',')}); limit 500; offset ${offset};`,
      );
      for (const r of rows) seen.get(r.popularity_type)?.add(r.game_id);
      if (rows.length < 500) break;
      offset += 500;
    }
    process.stdout.write('.');
  }
  console.log('');
  return types
    .map((t) => ({ ...t, games: seen.get(t.id) }))
    .sort((a, b) => b.games.size - a.games.size);
}

async function fetchByIds(igdb, ids) {
  if (ids.length === 0) return [];
  const games = await igdb(
    'games',
    `fields ${FIELDS}; where id = (${ids.join(',')}); sort id asc; limit 500;`,
  );
  return games;
}

async function writeFixtures(igdb, profiles) {
  const r0 = profiles.filter(RECORTES[0].test);
  const r1 = new Set(profiles.filter(RECORTES[1].test).map((p) => p.id));
  const final = profiles.filter(RECORTES.find((r) => r.id === FINAL).test);

  const sets = {
    complete: spread(
      final.filter((p) => !p.upcoming && p.developer && p.languages && p.keywords > 0),
      25,
    ),
    upcoming: spread(
      final.filter((p) => p.upcoming),
      5,
    ),
    // campos ausentes, que o mapeador do B-10 precisa tolerar
    sparse: spread(
      r0.filter((p) => !r1.has(p.id) || !p.developer || !p.languages),
      10,
    ),
    'major-publisher': spread(
      profiles.filter((p) => p.major.length > 0),
      10,
    ),
  };

  await mkdir(FIXTURES_DIR, { recursive: true });
  const written = {};
  for (const [name, list] of Object.entries(sets)) {
    const games = await fetchByIds(
      igdb,
      list.map((p) => p.id),
    );
    await writeFile(
      resolve(FIXTURES_DIR, `games.${name}.json`),
      `${JSON.stringify(games, null, 2)}\n`,
      'utf8',
    );
    written[name] = games.length;
  }
  return written;
}

function coverageTable(groups) {
  const header = `| Campo | ${groups.map((g) => `${g.id} (${fmt(g.list.length)})`).join(' | ')} |`;
  const sep = `| --- | ${groups.map(() => '---').join(' | ')} |`;
  const rows = Object.entries(FIELD_CHECKS).map(
    ([label, check]) =>
      `| ${label} | ${groups.map((g) => pct(g.list.filter(check).length, g.list.length)).join(' | ')} |`,
  );
  return [header, sep, ...rows].join('\n');
}

function featureStats(list) {
  const distinct = new Set();
  let total = 0;
  for (const p of list) {
    total += p.features.length;
    for (const f of p.features) distinct.add(f);
  }
  const avg = total / (list.length || 1);
  // Vetor esparso em memória: ~16 bytes por par (id do atributo, peso) mais
  // ~200 bytes de objeto por jogo. Ordem de grandeza, não medida (B-31 mede).
  const estimateMb = (total * 16 + list.length * 200) / 1024 / 1024;
  return { distinct: distinct.size, avg, estimateMb };
}

function buildReport({
  today,
  totals,
  profiles,
  groups,
  publishers,
  primitives,
  sample,
  fixtures,
  analysis,
}) {
  const countries = new Map();
  const final = groups.find((g) => g.id === FINAL).list;
  for (const p of final) {
    for (const c of p.countries) countries.set(c, (countries.get(c) ?? 0) + 1);
  }
  const topCountries = [...countries.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const gate = (check, list) => {
    const share = list.filter(check).length / (list.length || 1);
    return `${pct(list.filter(check).length, list.length)} — ${share >= 0.5 ? 'aprovado (segue P0)' : 'reprovado (vira P1)'}`;
  };
  const gateRows = groups
    .map(
      (g) =>
        `| ${g.id} | ${gate(FIELD_CHECKS['País da desenvolvedora'], g.list)} | ${gate(FIELD_CHECKS['Idiomas suportados'], g.list)} |`,
    )
    .join('\n');

  const sampleUpcoming = new Set(sample.filter((p) => p.upcoming).map((p) => p.id));
  const sampleReleasedCount = sample.length - sampleUpcoming.size;
  const primitiveRows = primitives
    .filter((t) => t.games.size > 0)
    .map((t) => {
      const upcoming = [...t.games].filter((id) => sampleUpcoming.has(id)).length;
      const released = t.games.size - upcoming;
      return `| ${t.id} | ${t.name} | ${t.popularity_source} | ${pct(released, sampleReleasedCount)} | ${pct(upcoming, sampleUpcoming.size)} |`;
    })
    .join('\n');

  return `# Relatório do marco M0 — viabilidade dos dados da IGDB

Gerado em ${today} pelo script \`scripts/igdb-spike.mjs\` (item B-07). As seções 1
a 7 são refeitas a cada execução; a seção 8 (análise e decisões) é escrita à mão
e o script a preserva.

Base: **censo de ${fmt(profiles.length)} jogos** principais com o gênero Indie
(\`${INDIE_WHERE}\`), percorridos por paginação ordenada por id.

## 1. Tamanho do catálogo

| Medida | Jogos |
| --- | --- |
| Jogos principais na IGDB | ${fmt(totals.all)} |
| Com o gênero Indie | ${fmt(totals.indie)} |
| Indie com lançamento futuro | ${fmt(profiles.filter((p) => p.upcoming).length)} |
| Indie sem data de lançamento | ${fmt(profiles.filter((p) => p.date == null).length)} |
| Removidos pelo critério de publisher provisório | ${fmt(profiles.filter((p) => p.major.length > 0).length)} |

### Recortes medidos (${FINAL} é o recorte aprovado no M0)

| Recorte | Critério | Jogos | Lançamento futuro |
| --- | --- | --- | --- |
${groups.map((g) => `| ${g.id} | ${g.label} | ${fmt(g.list.length)} | ${fmt(g.list.filter((p) => p.upcoming).length)} |`).join('\n')}

## 2. Cobertura dos campos por recorte

${coverageTable(groups)}

## 3. Portão do F-06 (filtros de país e idioma)

Regra: abaixo de 50% de cobertura no catálogo final, o filtro sai do P0 e vira P1 (B-21).

| Recorte | País do estúdio | Idioma |
| --- | --- | --- |
${gateRows}

## 4. Atributos de conteúdo (dimensiona o B-12 e o B-31)

| Recorte | Atributos distintos | Média por jogo | Memória estimada do índice |
| --- | --- | --- | --- |
${groups
  .map((g) => {
    const s = featureStats(g.list);
    return `| ${g.id} | ${fmt(s.distinct)} | ${s.avg.toFixed(1)} | ~${s.estimateMb.toFixed(1)} MB |`;
  })
  .join('\n')}

A estimativa é só ordem de grandeza (vetor esparso de gêneros, temas e
palavras-chave antes do descarte por limites do TF-IDF); a medição real é do B-31.

## 5. Países de desenvolvedora mais frequentes (${FINAL})

Códigos ISO 3166-1 numéricos, como a IGDB devolve.

| Código | Jogos |
| --- | --- |
${topCountries.map(([c, n]) => `| ${c} | ${fmt(n)} |`).join('\n') || '| — | — |'}

## 6. Indicadores de popularidade (p_j da seção 12)

Campos do próprio jogo, no recorte ${FINAL}: avaliações em
${pct(final.filter((p) => p.ratings > 0).length, final.length)}, \`hypes\` em
${pct(final.filter((p) => p.hypes > 0).length, final.length)}. Entre os jogos de ${FINAL} com
lançamento futuro, \`hypes\` cobre
${pct(final.filter((p) => p.upcoming && p.hypes > 0).length, final.filter((p) => p.upcoming).length)}.

### Primitivos do PopScore (\`popularity_primitives\`)

Amostra de ${fmt(sample.length)} jogos de ${FINAL} (${fmt(sampleReleasedCount)} lançados e
${fmt(sampleUpcoming.size)} com lançamento futuro). Cobertura = jogos da amostra com
pelo menos um valor daquele tipo.

| Tipo | Nome | Fonte | Lançados | Futuros |
| --- | --- | --- | --- | --- |
${primitiveRows || '| — | — | — | — | — |'}

## 7. Publishers que o critério provisório remove

| Publisher | Jogos indie removidos |
| --- | --- |
${publishers.map(([name, n]) => `| ${name} | ${fmt(n)} |`).join('\n') || '| — | — |'}

## 8. Análise e decisões

${analysis}

## Fixtures

Salvas em \`apps/api/test/fixtures/igdb/\` para os testes do B-10 e do B-11:
${Object.entries(fixtures)
  .map(([name, n]) => `\`games.${name}.json\` (${n})`)
  .join(', ')}.
`;
}

// A seção 8 é escrita à mão: reaproveita a do relatório anterior, se houver.
async function previousAnalysis(reportPath) {
  try {
    const old = (await readFile(reportPath, 'utf8')).replace(/\r\n/g, '\n');
    const match = old.match(/## 8\. Análise e decisões\n\n([\s\S]*?)\n+## Fixtures/);
    if (match) return match[1].trim();
  } catch {
    /* primeiro relatório */
  }
  return '_A preencher depois da execução._';
}

async function loadEnv() {
  if (process.env.IGDB_CLIENT_ID && process.env.IGDB_CLIENT_SECRET) return;
  try {
    const raw = await readFile(resolve(ROOT, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/);
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
  const now = Math.floor(Date.now() / 1000);

  console.log('Contando o catálogo...');
  const totals = {
    all: (await igdb('games/count', `where ${BASE_WHERE};`)).count,
    indie: (await igdb('games/count', `where ${INDIE_WHERE};`)).count,
  };
  console.log(`  ${fmt(totals.all)} jogos principais, ${fmt(totals.indie)} com o gênero Indie`);

  console.log('Percorrendo os jogos indie...');
  const profiles = await census(igdb, now);

  const groups = RECORTES.map((r) => ({ ...r, list: profiles.filter(r.test) }));
  for (const g of groups) console.log(`  ${g.id}: ${fmt(g.list.length)} jogos`);

  const publisherCounts = new Map();
  for (const p of profiles) {
    for (const name of new Set(p.major)) {
      publisherCounts.set(name, (publisherCounts.get(name) ?? 0) + 1);
    }
  }
  const publishers = [...publisherCounts.entries()].sort((a, b) => b[1] - a[1]);

  const final = groups.find((g) => g.id === FINAL).list;
  const sample = [
    ...spread(
      final.filter((p) => !p.upcoming),
      PRIMITIVE_SAMPLE,
    ),
    ...spread(
      final.filter((p) => p.upcoming),
      PRIMITIVE_SAMPLE,
    ),
  ];
  console.log(`Medindo o PopScore em ${fmt(sample.length)} jogos de ${FINAL}`);
  const primitives = await primitivesCoverage(igdb, sample);

  console.log('Salvando fixtures...');
  const fixtures = await writeFixtures(igdb, profiles);

  const today = new Date().toISOString().slice(0, 10);
  const reportPath = resolve(ROOT, 'docs/m0-relatorio-igdb.md');
  const report = buildReport({
    today,
    totals,
    profiles,
    groups,
    publishers,
    primitives,
    sample,
    fixtures,
    analysis: await previousAnalysis(reportPath),
  });
  await writeFile(reportPath, report, 'utf8');

  console.log('\nPronto.');
  console.log('  docs/m0-relatorio-igdb.md');
  console.log(
    `  apps/api/test/fixtures/igdb/ (${Object.entries(fixtures)
      .map(([n, c]) => `${c} ${n}`)
      .join(', ')})`,
  );
}

main().catch((err) => {
  console.error(`\nErro: ${err.message}`);
  process.exit(1);
});
