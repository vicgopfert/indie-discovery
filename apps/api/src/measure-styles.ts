import { existsSync } from 'node:fs';
import { apiEnvSchema, parseEnv, rootEnvFile } from './config/env';
import { FeatureType } from './generated/prisma/client';
import { FeatureLabels } from './modules/catalog/feature-labels';
import {
  buildContentIndex,
  type ContentIndex,
  isLabeledFeatureType,
} from './modules/recommendation/content-index';
import { ContentIndexRepository } from './modules/recommendation/content-index.repository';
import { type Interest, pickInterests } from './modules/recommendation/scoring/interests';
import { buildProfile, type Profile } from './modules/recommendation/scoring/profile';
import { readScoringConfig } from './modules/recommendation/scoring/scoring-config';
import { excludedKeywordMatcher, readTfidfConfig } from './modules/recommendation/tfidf';
import {
  type CuratedStyle,
  readStylesConfig,
  type StyleMatch,
  styleMatcher,
} from './modules/styles/styles';
import { PrismaService } from './prisma/prisma.service';

// Medição do B-73: cobertura do rascunho de estilos (config/styles.json) no catálogo e nos
// perfis de teste, amostra de precisão dos termos do resumo e efeito do desempate na escolha dos
// interesses. Só lê o banco. Uso: pnpm --filter api styles:measure > relatorio.md
const TOP_KEYWORDS = 300;
const PROFILE_SEED = 71;
const PROFILES = 200;
const PRECISION_SEED = 73;
const PRECISION_SAMPLE = 20;
const IDENTICAL_GROUP = 11;
const FEW_TAGS = 2;

type Version = 'keyword' | 'summary' | 'both';
const VERSIONS: Version[] = ['keyword', 'summary', 'both'];
const VERSION_NAMES = { keyword: 'Só palavras-chave', summary: 'Só resumo', both: 'As duas' };

interface CatalogGame {
  id: string;
  name: string;
  matches: StyleMatch[];
  styles: Record<Version, Set<string>>;
}

async function main() {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const { DATABASE_URL } = parseEnv(apiEnvSchema.pick({ DATABASE_URL: true }), process.env);
  const draft = readStylesConfig();
  const tfidf = readTfidfConfig();
  const scoring = readScoringConfig();
  const labels = FeatureLabels.fromFile();

  const prisma = new PrismaService(DATABASE_URL);
  try {
    const rows = await prisma.game.findMany({
      where: { inCatalog: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        summary: true,
        features: {
          select: { feature: { select: { type: true, igdbId: true, slug: true, name: true } } },
        },
      },
    });
    const styleKeywords = draft.styles.flatMap(({ keywords }) => keywords);
    const indexRows = await new ContentIndexRepository(prisma).loadRows(styleKeywords);
    const index = buildContentIndex(indexRows, tfidf, draft.styles);
    const match = styleMatcher(draft.styles);
    const games: CatalogGame[] = rows.map(({ id, name, summary, features }) => {
      const keywords = features
        .filter(({ feature }) => feature.type === FeatureType.KEYWORD)
        .map(({ feature }) => feature.slug);
      const matches = match({ keywords, summary });
      const by = (source: StyleMatch['source']) =>
        new Set(matches.filter((m) => m.source === source).map((m) => m.style));
      const keyword = by('keyword');
      const summaryStyles = by('summary');
      return {
        id,
        name,
        matches,
        styles: { keyword, summary: summaryStyles, both: new Set([...keyword, ...summaryStyles]) },
      };
    });
    const byId = new Map(games.map((game) => [game.id, game]));

    const out: string[] = [];
    out.push(`# Medição dos estilos (B-73)`, '');
    out.push(
      `Catálogo do banco local em ${new Date().toISOString().slice(0, 10)}: ${games.length} jogos com inCatalog; ${draft.styles.length} estilos no rascunho.`,
      '',
    );
    out.push(...keywordTable(rows, excludedKeywordMatcher(tfidf)));
    out.push(...coverage(games));
    out.push(...styleTable(games, draft.styles, scoring.lists.interestMaxDocumentRatio));
    out.push(...slices(games, index, byId));
    const profiles = ratingProfiles(games.map(({ id }) => id));
    out.push(...profileCoverage(profiles, byId));
    out.push(...precisionSample(games, draft.styles));
    out.push(...tieBreaks(profiles, index, byId, draft.styles, games.length, labels, scoring));
    console.log(out.join('\n'));
  } finally {
    await prisma.$disconnect();
  }
}

function keywordTable(
  rows: {
    features: { feature: { type: FeatureType; igdbId: number; slug: string; name: string } }[];
  }[],
  isExcluded: ReturnType<typeof excludedKeywordMatcher>,
) {
  const counts = new Map<number, { name: string; slug: string; games: number }>();
  for (const { features } of rows) {
    for (const { feature } of features) {
      if (feature.type !== FeatureType.KEYWORD || isExcluded(feature)) continue;
      const entry = counts.get(feature.igdbId) ?? {
        name: feature.name,
        slug: feature.slug,
        games: 0,
      };
      entry.games++;
      counts.set(feature.igdbId, entry);
    }
  }
  const top = [...counts.values()]
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
    .slice(0, TOP_KEYWORDS);
  return [
    `## 1. As ${TOP_KEYWORDS} palavras-chave mais frequentes`,
    '',
    `${counts.size} palavras-chave em algum jogo do catálogo, depois das exclusões de config/recommendation.json.`,
    '',
    '| # | Palavra-chave | Slug | Jogos | % |',
    '| --- | --- | --- | --- | --- |',
    ...top.map(
      (k, i) => `| ${i + 1} | ${k.name} | ${k.slug} | ${k.games} | ${pct(k.games, rows.length)} |`,
    ),
    '',
  ];
}

function coverage(games: readonly CatalogGame[]) {
  return [
    '## 3. Cobertura do catálogo',
    '',
    '| Versão | Jogos com ao menos um estilo | Mediana de estilos por jogo | Mediana entre os cobertos |',
    '| --- | --- | --- | --- |',
    ...VERSIONS.map((version) => {
      const sizes = games.map(({ styles }) => styles[version].size);
      const covered = sizes.filter((size) => size > 0);
      return `| ${VERSION_NAMES[version]} | ${covered.length} (${pct(covered.length, games.length)}) | ${median(sizes)} | ${median(covered)} |`;
    }),
    '',
  ];
}

function styleTable(
  games: readonly CatalogGame[],
  styles: readonly CuratedStyle[],
  maxRatio: number,
) {
  const count = (slug: string, version: Version) =>
    games.filter(({ styles: s }) => s[version].has(slug)).length;
  return [
    '### Frequência de cada estilo',
    '',
    `Marcas: abaixo de 3 jogos ou acima de ${maxRatio * 100}% do catálogo (interestMaxDocumentRatio), na versão com as duas fontes.`,
    '',
    '| Estilo | Categoria | Palavras-chave | Resumo | As duas | Marca |',
    '| --- | --- | --- | --- | --- | --- |',
    ...styles.map((style) => {
      const [k, s, b] = VERSIONS.map((version) => count(style.slug, version));
      const flag =
        b! < 3 ? 'abaixo de 3' : b! / games.length > maxRatio ? `acima de ${maxRatio * 100}%` : '';
      return `| ${style.name} | ${style.category} | ${k} (${pct(k!, games.length)}) | ${s} (${pct(s!, games.length)}) | ${b} (${pct(b!, games.length)}) | ${flag} |`;
    }),
    '',
  ];
}

function slices(
  games: readonly CatalogGame[],
  index: ContentIndex,
  byId: ReadonlyMap<string, CatalogGame>,
) {
  const keyOf = (positions: Int32Array) => positions.join(',');
  const groups = new Map<string, number>();
  for (const game of index.games) {
    groups.set(keyOf(game.featurePositions), (groups.get(keyOf(game.featurePositions)) ?? 0) + 1);
  }
  const position = (type: FeatureType, slug: string) =>
    index.features.findIndex((f) => f.type === type && f.slug === slug);
  const adventureAction = keyOf(
    Int32Array.from(
      [position(FeatureType.GENRE, 'adventure'), position(FeatureType.THEME, 'action')].sort(
        (a, b) => a - b,
      ),
    ),
  );

  const recortes: [string, (game: (typeof index.games)[number]) => boolean][] = [
    [
      `Vetor idêntico ao de pelo menos 10 outros jogos`,
      (game) => groups.get(keyOf(game.featurePositions))! >= IDENTICAL_GROUP,
    ],
    [`Até ${FEW_TAGS} etiquetas no vetor`, (game) => game.featurePositions.length <= FEW_TAGS],
    ['Só Aventura e Ação no vetor', (game) => keyOf(game.featurePositions) === adventureAction],
  ];
  return [
    '### Cobertura nos recortes',
    '',
    '| Recorte | Jogos | Só palavras-chave | Só resumo | As duas |',
    '| --- | --- | --- | --- | --- |',
    ...recortes.map(([name, test]) => {
      const slice = index.games.filter(test).map(({ id }) => byId.get(id)!);
      const covered = VERSIONS.map((version) => {
        const n = slice.filter(({ styles }) => styles[version].size > 0).length;
        return `${n} (${pct(n, slice.length)})`;
      });
      return `| ${name} | ${slice.length} (${pct(slice.length, games.length)}) | ${covered.join(' | ')} |`;
    }),
    '',
  ];
}

interface RatingProfile {
  ratings: { gameId: string; score: number }[];
}

// Os mesmos perfis do B-71: quatro jogos sorteados do catálogo (ordem do id), notas 5, 5, 4 e 1.
function ratingProfiles(gameIds: readonly string[]): RatingProfile[] {
  const random = mulberry32(PROFILE_SEED);
  return Array.from({ length: PROFILES }, () => ({
    ratings: sample(random, gameIds, 4).map((gameId, i) => ({ gameId, score: [5, 5, 4, 1][i]! })),
  }));
}

function profileCoverage(
  profiles: readonly RatingProfile[],
  byId: ReadonlyMap<string, CatalogGame>,
) {
  const liked = profiles.flatMap(({ ratings }) =>
    ratings.filter(({ score }) => score > 3).map(({ gameId }) => byId.get(gameId)!),
  );
  return [
    `### Perfis por avaliações (semente ${PROFILE_SEED})`,
    '',
    `Jogos com peso positivo na biblioteca dos ${profiles.length} perfis: ${liked.length}.`,
    '',
    '| Versão | Com ao menos um estilo |',
    '| --- | --- |',
    ...VERSIONS.map((version) => {
      const n = liked.filter(({ styles }) => styles[version].size > 0).length;
      return `| ${VERSION_NAMES[version]} | ${n} (${pct(n, liked.length)}) |`;
    }),
    '',
  ];
}

function precisionSample(games: readonly CatalogGame[], styles: readonly CuratedStyle[]) {
  const names = new Map(styles.map(({ slug, name }) => [slug, name]));
  const summaryOnly = games.flatMap((game) => {
    const only = game.matches.filter(
      (m) => m.source === 'summary' && !game.styles.keyword.has(m.style),
    );
    return only.length > 0 ? [{ game, only }] : [];
  });
  const random = mulberry32(PRECISION_SEED);
  const picked = sample(random, summaryOnly, Math.min(PRECISION_SAMPLE, summaryOnly.length));
  return [
    `## 4. Amostra dos estilos que vêm só do resumo (semente ${PRECISION_SEED})`,
    '',
    `${summaryOnly.length} jogos recebem ao menos um estilo só pelo resumo.`,
    '',
    '| # | Jogo | Estilo | Termo | Trecho |',
    '| --- | --- | --- | --- | --- |',
    ...picked.map(({ game, only }, i) => {
      const m = only[Math.floor(random() * only.length)]!;
      return `| ${i + 1} | ${game.name} | ${names.get(m.style)} | ${m.term} | ${m.excerpt!.replace(/\|/g, '/')} |`;
    }),
    '',
  ];
}

interface Candidate {
  key: string;
  label: string;
  // u_k do gênero ou tema; num estilo, a soma dos u_k das palavras-chave dele.
  u: number;
  documentRatio: number;
  // Soma dos pesos dos jogos de peso positivo da biblioteca que têm o atributo, cobertos ou não.
  libraryWeight: number;
  order: number;
}

type TieBreak = 'u' | 'frequency' | 'library';

interface Pick {
  key: string;
  label: string;
  coverage: number;
  tied: boolean;
}

const TIE_BREAKS: Record<TieBreak, (a: Candidate, b: Candidate) => number> = {
  u: (a, b) => b.u - a.u || a.order - b.order,
  frequency: (a, b) => a.documentRatio - b.documentRatio || b.u - a.u || a.order - b.order,
  library: (a, b) =>
    b.libraryWeight - a.libraryWeight || a.documentRatio - b.documentRatio || a.order - b.order,
};

// A escolha gulosa do B-71 (interests.ts), generalizada para candidatos que não são posições do
// índice e para outros desempates. Conferida contra pickInterests nos perfis sem estilos.
function greedy(
  items: readonly { weight: number; keys: ReadonlySet<string> }[],
  candidates: readonly Candidate[],
  tieBreak: TieBreak,
  max: number,
): Pick[] {
  const left = new Map(candidates.map((c) => [c.key, c]));
  let uncovered = [...items];
  const picked: Pick[] = [];
  while (picked.length < max) {
    const gains = new Map<string, number>();
    for (const { weight, keys } of uncovered) {
      for (const key of keys) if (left.has(key)) gains.set(key, (gains.get(key) ?? 0) + weight);
    }
    let best: { candidate: Candidate; gain: number } | null = null;
    let ties = 0;
    for (const [key, gain] of gains) {
      const candidate = left.get(key)!;
      if (best === null || gain > best.gain) {
        best = { candidate, gain };
        ties = 0;
      } else if (gain === best.gain) {
        ties++;
        if (TIE_BREAKS[tieBreak](candidate, best.candidate) < 0) best = { candidate, gain };
      }
    }
    if (best === null) break;
    const { key, label } = best.candidate;
    picked.push({ key, label, coverage: best.gain, tied: ties > 0 });
    left.delete(key);
    uncovered = uncovered.filter(({ keys }) => !keys.has(key));
  }
  return picked;
}

const SCENARIOS = {
  A: { styles: false, tieBreak: 'u', name: 'A. Gêneros e temas, desempate por u_k (B-71)' },
  B: { styles: false, tieBreak: 'frequency', name: 'B. Gêneros e temas, pelo menos frequente' },
  E: {
    styles: false,
    tieBreak: 'library',
    name: 'E. Gêneros e temas, pelo peso na biblioteca (atual)',
  },
  C: { styles: true, tieBreak: 'u', name: 'C. Com estilos, desempate por u_k' },
  D: { styles: true, tieBreak: 'frequency', name: 'D. Com estilos, pelo menos frequente' },
  F: { styles: true, tieBreak: 'library', name: 'F. Com estilos, pelo peso na biblioteca (B-74)' },
} as const satisfies Record<string, { styles: boolean; tieBreak: TieBreak; name: string }>;

type Scenario = keyof typeof SCENARIOS;

function tieBreaks(
  profiles: readonly RatingProfile[],
  index: ContentIndex,
  byId: ReadonlyMap<string, CatalogGame>,
  styles: readonly CuratedStyle[],
  catalogSize: number,
  labels: FeatureLabels,
  scoring: ReturnType<typeof readScoringConfig>,
) {
  const { maxInterests, interestMaxDocumentRatio } = scoring.lists;
  const hidden = new Set<number>();
  index.features.forEach((f, p) => {
    if (isLabeledFeatureType(f.type) && labels.isHidden(f.type, f.slug)) hidden.add(p);
  });
  const styleRatio = new Map(
    styles.map(({ slug }) => [
      slug,
      [...byId.values()].filter(({ styles: s }) => s.both.has(slug)).length / catalogSize,
    ]),
  );
  const keywordPositions = new Map(
    styles.map(({ slug, keywords }) => [
      slug,
      index.features.flatMap((f, p) =>
        f.type === FeatureType.KEYWORD && keywords.includes(f.slug) ? [p] : [],
      ),
    ]),
  );

  const scenarioNames = Object.keys(SCENARIOS) as Scenario[];
  const runs = Object.fromEntries(scenarioNames.map((s) => [s, [] as Pick[][]])) as Record<
    Scenario,
    Pick[][]
  >;
  const covered = Object.fromEntries(scenarioNames.map((s) => [s, 0])) as Record<Scenario, number>;
  let mismatches = 0;
  let mismatchesWithoutStyles = 0;

  for (const { ratings } of profiles) {
    const interactions = ratings.map(({ gameId, score }) => {
      const game = index.games[index.positionByGameId.get(gameId)!]!;
      return { gameId, score, lists: [], vector: game, styles: game.styles };
    });
    const profile: Profile = buildProfile(interactions, [], index.features.length, scoring);
    const keyOf = ({ attribute }: Interest) =>
      attribute.kind === 'feature'
        ? `f${attribute.position}`
        : `s${index.styles[attribute.style]!.slug}`;
    const reference = pickInterests(profile, [], index, hidden, scoring).map(keyOf);
    const withoutStyles = buildProfile(
      interactions.map((interaction) => ({ ...interaction, styles: [] })),
      [],
      index.features.length,
      scoring,
    );
    const referenceWithoutStyles = pickInterests(
      withoutStyles,
      [],
      { features: index.features, styles: [] },
      hidden,
      scoring,
    ).map(keyOf);

    const items = (withStyles: boolean) =>
      profile.games
        .filter(({ weight }) => weight > 0)
        .map(({ gameId, weight, vector }) => ({
          weight,
          keys: new Set([
            ...[...vector.featurePositions].map((p) => `f${p}`),
            ...(withStyles ? [...byId.get(gameId)!.styles.both].map((s) => `s${s}`) : []),
          ]),
        }));
    const positive = items(true);
    const libraryWeight = (key: string) =>
      positive.filter(({ keys }) => keys.has(key)).reduce((sum, { weight }) => sum + weight, 0);

    const features: Candidate[] = [];
    profile.vector.forEach((u, p) => {
      const f = index.features[p]!;
      if (u <= 0 || f.type === FeatureType.KEYWORD || hidden.has(p)) return;
      if (f.documentRatio > interestMaxDocumentRatio) return;
      const key = `f${p}`;
      features.push({
        key,
        label: f.name,
        u,
        documentRatio: f.documentRatio,
        libraryWeight: libraryWeight(key),
        order: p,
      });
    });
    // Como u_k > 0 nos gêneros e temas: o estilo só concorre se a soma dos pesos dos jogos da
    // biblioteca que o têm, inclusive os de nota baixa, for positiva.
    const styleCandidates: Candidate[] = styles.flatMap(({ slug, name }, i) => {
      const net = profile.games
        .filter(({ gameId }) => byId.get(gameId)!.styles.both.has(slug))
        .reduce((sum, { weight }) => sum + weight, 0);
      const ratio = styleRatio.get(slug)!;
      if (net <= 0 || ratio > interestMaxDocumentRatio) return [];
      const key = `s${slug}`;
      return [
        {
          key,
          label: name,
          u: keywordPositions.get(slug)!.reduce((sum, p) => sum + profile.vector[p]!, 0),
          documentRatio: ratio,
          libraryWeight: libraryWeight(key),
          order: index.features.length + i,
        },
      ];
    });

    for (const scenario of scenarioNames) {
      const { styles: withStyles, tieBreak } = SCENARIOS[scenario];
      const run = greedy(
        items(withStyles),
        withStyles ? [...features, ...styleCandidates] : features,
        tieBreak,
        maxInterests,
      );
      runs[scenario].push(run);
      covered[scenario] += positive.filter(({ keys }) =>
        run.some(({ key }) => keys.has(key)),
      ).length;
    }
    const keys = (scenario: Scenario) =>
      runs[scenario]
        .at(-1)!
        .map(({ key }) => key)
        .join();
    if (keys('F') !== reference.join()) mismatches++;
    if (keys('E') !== referenceWithoutStyles.join()) mismatchesWithoutStyles++;
  }

  const totalLiked = profiles.length * 3;
  const describe = (scenario: Scenario) => {
    const all = runs[scenario];
    const hist = [0, 1, 2, 3, 4].map((n) => all.filter((r) => r.length === n).length).join(' / ');
    const picks = all.flat();
    const styleCount = picks.filter(({ key }) => key.startsWith('s')).length;
    const tied = picks.filter(({ tied }) => tied).length;
    return `| ${SCENARIOS[scenario].name} | ${hist} | ${picks.length} | ${tied} | ${styleCount} | ${covered[scenario]} (${pct(covered[scenario], totalLiked)}) |`;
  };
  const changes = (x: Scenario, y: Scenario) => {
    let profilesChanged = 0;
    let picksChanged = 0;
    runs[x].forEach((run, i) => {
      const other = runs[y][i]!;
      const length = Math.max(run.length, other.length);
      let changed = 0;
      for (let k = 0; k < length; k++) if (run[k]?.key !== other[k]?.key) changed++;
      if (changed > 0) profilesChanged++;
      picksChanged += changed;
    });
    return `- ${x} → ${y}: ${profilesChanged} perfis mudam, ${picksChanged} escolhas mudam de atributo ou de posição.`;
  };
  const topStyles = (scenario: Scenario) => {
    const counts = new Map<string, number>();
    for (const { key, label } of runs[scenario].flat()) {
      if (key.startsWith('s')) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([n, c]) => `${n} (${c})`)
      .join(', ');
  };

  return [
    `## 5. Desempate na escolha dos interesses (perfis da semente ${PROFILE_SEED})`,
    '',
    `Conferência: pickInterests, com os estilos do índice, deu o mesmo que o cenário F em ${profiles.length - mismatches} de ${profiles.length} perfis; sem estilos, o mesmo que o cenário E em ${profiles.length - mismatchesWithoutStyles}.`,
    '',
    '| Cenário | Perfis com 0 / 1 / 2 / 3 / 4 interesses | Interesses | Escolhas com empate na cobertura | Interesses que são estilos | Jogos com peso positivo cobertos |',
    '| --- | --- | --- | --- | --- | --- |',
    ...scenarioNames.map(describe),
    '',
    changes('A', 'B'),
    changes('A', 'E'),
    changes('C', 'D'),
    changes('C', 'F'),
    `- Estilos mais escolhidos em D: ${topStyles('D')}.`,
    `- Estilos mais escolhidos em F: ${topStyles('F')}.`,
    '',
  ];
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

// Sorteio sem repetição, como na medição do B-71.
function sample<T>(random: () => number, items: readonly T[], count: number): T[] {
  const picked = new Set<T>();
  while (picked.size < count) picked.add(items[Math.floor(random() * items.length)]!);
  return [...picked];
}

function median(values: readonly number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function pct(part: number, total: number) {
  return `${((100 * part) / total).toFixed(1).replace('.', ',')}%`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
