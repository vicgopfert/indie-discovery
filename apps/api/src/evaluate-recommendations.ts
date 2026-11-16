import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PreferenceOptions } from '@indie/contracts';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { apiEnvSchema, parseEnv, rootEnvFile } from './config/env';
import { type CriteriaResult, evaluateCriteria } from './evaluation/criteria';
import { readEvaluationConfig } from './evaluation/evaluation-config';
import {
  attributeProfiles,
  coherentProfiles,
  coldStartProfiles,
  type EvaluationProfile,
  type Family,
  type ProfileCatalog,
  SAMPLINGS,
} from './evaluation/profiles';
import { type EvaluationReport, renderReport, renderRound2 } from './evaluation/report';
import { baselineComparisons, summarize, type Variant, variantsOf } from './evaluation/results';
import {
  blockSharesChecks,
  blockSharesRule,
  candidate,
  type LambdaPair,
  lambdaPairChecks,
  lambdaPairRule,
  preferenceWeightChecks,
  preferenceWeightRule,
  type RuleResult,
  shelfLimitRule,
  upcomingRecords,
} from './evaluation/rules';
import {
  evaluateProfile,
  listOf,
  mergeOutcomes,
  type Method,
  METHODS,
  MODES,
  type RunContext,
} from './evaluation/run';
import { DiscoveryMode, FeatureType } from './generated/prisma/client';
import { FeatureLabels } from './modules/catalog/feature-labels';
import { LibraryModule } from './modules/library/library.module';
import { LibraryService } from './modules/library/library.service';
import {
  buildContentIndex,
  type ContentIndex,
  hiddenPositionsOf,
  isLabeledFeatureType,
} from './modules/recommendation/content-index';
import { ContentIndexRepository } from './modules/recommendation/content-index.repository';
import { shelfTagsOf } from './modules/recommendation/content-index.service';
import {
  readScoringConfig,
  type ScoringConfig,
} from './modules/recommendation/scoring/scoring-config';
import { readTfidfConfig, type TfidfConfig } from './modules/recommendation/tfidf';
import { readTagVocabulary, tagSlug } from './modules/tags/tags';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import {
  assertLocalDatabase,
  findSeedInputs,
  profileUserId,
  RATED_SCORES,
  seedProfiles,
} from './snapshot-recommendations';

// Avaliação offline do recomendador (F-14, B-37; docs/avaliacao-offline.md). Roda o núcleo de
// pontuação em memória, sem criar contas, nas quatro famílias de perfis de config/evaluation.json.
// A rodada 1 mede a configuração atual; a rodada 2 aplica as regras de calibração, na ordem a → b →
// c → d, cada uma sobre os valores escolhidos pelas anteriores. Só lê o banco, e só o local.
//
//   node dist/evaluate-recommendations.js <saída> [--round 1|2 [--rule a|b|c|d]]
//
// Grava <saída>.md com as tabelas e <saída>.json com todos os números.

const CONFIG_FILES = ['recommendation.json', 'evaluation.json', 'tags.json', 'feature-labels.json'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: rootEnvFile,
      validate: (env) => parseEnv(apiEnvSchema.pick({ DATABASE_URL: true }), env),
    }),
    PrismaModule,
    LibraryModule,
  ],
})
class EvaluationModule {}

// popularityCount e nome de cada jogo do índice, na posição dele.
async function catalogOf(
  prisma: PrismaService,
  index: ContentIndex,
  hidden: ReadonlySet<number>,
): Promise<ProfileCatalog> {
  const popularityCount = new Array<number>(index.games.length).fill(0);
  const names = new Array<string>(index.games.length).fill('');
  const games = await prisma.game.findMany({
    where: { inCatalog: true },
    select: { id: true, name: true, popularityCount: true },
  });
  for (const { id, name, popularityCount: count } of games) {
    const position = index.positionByGameId.get(id);
    if (position === undefined) continue;
    popularityCount[position] = count;
    names[position] = name;
  }
  return { index, hidden, popularityCount, names };
}

// As opções da partida a frio, em posições do índice; a que não está no índice fica de fora.
function optionPositions(index: ContentIndex, options: PreferenceOptions): number[] {
  const positionOf = new Map(
    index.features.map(({ type, slug }, position) => [`${type}:${slug}`, position]),
  );
  return [
    ...options.genres.map(({ slug }) => `${FeatureType.GENRE}:${slug}`),
    ...options.themes.map(({ slug }) => `${FeatureType.THEME}:${slug}`),
    ...options.tags.map(({ slug }) => `${FeatureType.TAG}:${slug}`),
  ].flatMap((key) => {
    const position = positionOf.get(key);
    return position === undefined ? [] : [position];
  });
}

// Família D: os perfis da semente 71, com os ids do snapshot, porque o desempate depende deles.
function seedFamily(
  index: ContentIndex,
  { rated, preferred }: ReturnType<typeof seedProfiles>,
): EvaluationProfile[] {
  return [
    ...rated.map((gameIds, i): EvaluationProfile => ({
      id: profileUserId(i),
      family: 'seed',
      sampling: null,
      stratum: 'rated',
      ratings: gameIds.map((gameId, j) => ({ gameId, score: RATED_SCORES[j]! })),
      preferencePositions: [],
      holdouts: [],
    })),
    ...preferred.map((featureIds, i): EvaluationProfile => ({
      id: profileUserId(rated.length + i),
      family: 'seed',
      sampling: null,
      stratum: 'preferred',
      ratings: [],
      preferencePositions: featureIds.flatMap((id) => {
        const position = index.positionByFeatureId.get(id);
        return position === undefined ? [] : [position];
      }),
      holdouts: [],
    })),
  ];
}

function runAll(context: RunContext, profiles: readonly EvaluationProfile[], label: string) {
  const started = performance.now();
  return profiles.map((profile, i) => {
    if (i % 250 === 0) {
      const seconds = ((performance.now() - started) / 1000).toFixed(0);
      console.error(`${label}: ${i} de ${profiles.length} perfis (${seconds} s)`);
    }
    return evaluateProfile(context, profile);
  });
}

function profileCounts(profiles: readonly EvaluationProfile[]): EvaluationReport['profiles'] {
  const counts = new Map<string, EvaluationReport['profiles'][number] & { used: Set<number> }>();
  for (const { family, sampling, stratum, attribute } of profiles) {
    const key = `${family}|${sampling}|${stratum}`;
    let entry = counts.get(key);
    if (entry === undefined) {
      entry = { family, sampling, stratum: stratum ?? 'all', count: 0, used: new Set() };
      counts.set(key, entry);
    }
    entry.count++;
    if (attribute !== undefined) entry.used.add(attribute);
  }
  return [...counts.values()].map(({ used, ...entry }) =>
    used.size > 0 ? { ...entry, attributes: used.size } : entry,
  );
}

function commitOf(): string {
  try {
    const commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
    return dirty ? `${commit} (com alterações não commitadas)` : commit;
  } catch {
    return 'desconhecido';
  }
}

function configHash(): string {
  const hash = createHash('sha256');
  for (const file of CONFIG_FILES)
    hash.update(readFileSync(resolve(process.cwd(), 'config', file)));
  return hash.digest('hex').slice(0, 16);
}

const RULES = ['a', 'b', 'c', 'd'] as const;
type Rule = (typeof RULES)[number];

async function evaluate(out: string, round: 1 | 2, only: Rule | null) {
  if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);
  const { DATABASE_URL } = parseEnv(apiEnvSchema.pick({ DATABASE_URL: true }), process.env);
  assertLocalDatabase(DATABASE_URL, 'A avaliação offline');

  const app = await NestFactory.createApplicationContext(EvaluationModule, { logger: ['error'] });
  try {
    const started = performance.now();
    const prisma = app.get(PrismaService);
    const labels = app.get(FeatureLabels);
    const evaluation = readEvaluationConfig();
    const tfidf = readTfidfConfig();
    const scoring = readScoringConfig();
    const vocabulary = readTagVocabulary();
    const shelfTags = shelfTagsOf(vocabulary);
    const rows = await new ContentIndexRepository(prisma).loadRows();
    const index = buildContentIndex(rows, tfidf, shelfTags);
    const hidden = hiddenPositionsOf(index, labels);
    const catalog = await catalogOf(prisma, index, hidden);
    const options = optionPositions(index, await app.get(LibraryService).findPreferenceOptions());
    const seed = seedProfiles(await findSeedInputs(prisma, labels));

    const coherent = SAMPLINGS.flatMap((sampling) =>
      coherentProfiles(catalog, sampling, evaluation),
    );
    const profiles = [
      ...SAMPLINGS.flatMap((sampling) => attributeProfiles(catalog, sampling, evaluation)),
      ...coherent,
      ...coldStartProfiles(catalog, options, evaluation),
      ...seedFamily(index, seed),
    ];
    const englishNames = new Map(
      vocabulary.tags
        .filter(({ accepted }) => accepted)
        .map((tag) => [tagSlug(tag), tag.englishName]),
    );
    const criteriaFor = (
      variantIndex: ContentIndex,
      variantScoring: ScoringConfig,
    ): CriteriaResult =>
      evaluateCriteria({
        index: variantIndex,
        hidden: hiddenPositionsOf(variantIndex, labels),
        scoring: variantScoring,
        evaluation,
        englishName: (position) => {
          const { type, slug } = variantIndex.features[position]!;
          return type === FeatureType.TAG ? (englishNames.get(slug) ?? null) : null;
        },
        displayName: (position) => {
          const { type, slug, name } = variantIndex.features[position]!;
          return isLabeledFeatureType(type) ? labels.name(type, slug, name) : name;
        },
        popularityCount: catalog.popularityCount,
        seedRated: seed.rated.map((gameIds) =>
          gameIds.map((gameId, j) => ({ gameId, score: RATED_SCORES[j]! })),
        ),
        seedPreferred: profiles
          .filter(({ family, stratum }) => family === 'seed' && stratum === 'preferred')
          .map(({ preferencePositions }) => preferencePositions),
        coherent: coherent
          .filter(({ sampling }) => sampling === 'uniform')
          .slice(0, evaluation.criteria.coherentProfiles),
      });

    const depth = Math.max(...evaluation.cutoffs);
    const meta = {
      Data: new Date().toISOString(),
      Commit: commitOf(),
      'Hash das configurações': configHash(),
      'Catálogo no índice': `${index.games.length} jogos, ${index.features.length} atributos`,
      Semente: evaluation.seed,
      Bootstrap: `${evaluation.bootstrap.resamples} reamostragens, semente ${evaluation.bootstrap.seed}`,
    };
    const run = (
      name: string,
      runIndex: ContentIndex,
      runScoring: ScoringConfig,
      runProfiles: readonly EvaluationProfile[],
      methods: readonly Method[],
    ) =>
      runAll(
        {
          index: runIndex,
          hidden: hiddenPositionsOf(runIndex, labels),
          scoring: runScoring,
          depth,
          seed: evaluation.seed,
          methods,
        },
        runProfiles,
        name,
      );
    const write = (
      results: unknown,
      markdown: (finalMeta: Record<string, string | number>) => string,
    ) => {
      const resultsHash = createHash('sha256').update(JSON.stringify(results)).digest('hex');
      const seconds = ((performance.now() - started) / 1000).toFixed(0);
      const finalMeta = {
        ...meta,
        'Hash dos resultados': resultsHash.slice(0, 16),
        Tempo: `${seconds} s`,
      };
      writeFileSync(`${out}.md`, markdown(finalMeta));
      writeFileSync(`${out}.json`, JSON.stringify({ meta: finalMeta, results }, null, 1));
      console.log(`${profiles.length} perfis; resultados ${resultsHash}`);
    };

    if (round === 1) {
      const name = 'configuração atual';
      const outcomes = run(name, index, scoring, profiles, METHODS);
      const report: EvaluationReport = {
        title: `Avaliação offline: ${name}`,
        meta,
        profiles: profileCounts(profiles),
        cutoffs: evaluation.cutoffs,
        groups: summarize(outcomes, evaluation, index.games.length),
        comparisons: baselineComparisons(outcomes, evaluation, evaluation.bootstrap),
        criteria: criteriaFor(index, scoring),
      };
      const results = [
        {
          name,
          profiles: report.profiles,
          groups: report.groups,
          comparisons: report.comparisons,
          criteria: report.criteria,
        },
      ];
      write(results, (finalMeta) => renderReport({ ...report, meta: finalMeta }));
      return;
    }

    const { bootstrap } = evaluation;
    const ofFamilies = (...families: Family[]) =>
      profiles.filter(({ family }) => families.includes(family));
    const rated = ofFamilies('attribute', 'coherent');
    const coldStart = ofFamilies('cold-start');
    const catalogSize = index.games.length;
    // Com --rule, só a regra pedida, sobre a configuração atual.
    const runs = (rule: Rule) => only === null || only === rule;
    const decimalName = (prefix: string, value: number) =>
      `${prefix}${String(value).replace('.', ',')}`;

    // Regra a: só os critérios, que não dependem dos perfis.
    let current: Variant = { name: '', tfidf, scoring, mode: null };
    const limitName = (limit: number) => `limite de ${Math.round(limit * 100)}%`;
    const limits = [
      { ...current, name: limitName(scoring.lists.specificMaxDocumentRatio) },
      ...variantsOf('shelfLimit', evaluation, tfidf, scoring).map((variant) => ({
        ...variant,
        name: limitName(variant.scoring.lists.specificMaxDocumentRatio),
      })),
    ];
    const ruleA = !runs('a')
      ? null
      : shelfLimitRule(
          limits[0]!.name,
          limits.map(({ name, scoring: limitScoring }) => {
            console.error(`regra a: ${name}`);
            return {
              name,
              value: limitScoring.lists.specificMaxDocumentRatio,
              criteria: criteriaFor(index, limitScoring),
            };
          }),
        );
    if (ruleA !== null) current = limits.find(({ name }) => name === ruleA.chosen)!;
    let currentIndex = index;

    // Regra b: o modo da regra, nas famílias A e B.
    const sharesMethods = [listOf(evaluation.rules.blockShares.mode)];
    const sharesName = ({ normalization, blockShares }: TfidfConfig) =>
      normalization === 'global'
        ? 'normalização global'
        : `fatias ${[blockShares.GENRE, blockShares.THEME, blockShares.TAG].map((share) => Math.round(share * 100)).join('/')}`;
    const sharesBase = !runs('b')
      ? null
      : run('regra b: atual', currentIndex, current.scoring, rated, sharesMethods);
    const sharesVariants = variantsOf('blockShares', evaluation, current.tfidf, current.scoring);
    const ruleB =
      sharesBase === null
        ? null
        : blockSharesRule(
            sharesName(current.tfidf),
            sharesVariants.map((variant) => {
              const name = sharesName(variant.tfidf);
              const variantIndex = buildContentIndex(rows, variant.tfidf, shelfTags);
              const outcomes = run(
                `regra b: ${name}`,
                variantIndex,
                variant.scoring,
                rated,
                sharesMethods,
              );
              return {
                ...candidate(
                  name,
                  null,
                  blockSharesChecks(sharesBase, outcomes, evaluation, bootstrap),
                ),
                criteria: criteriaFor(variantIndex, variant.scoring),
              };
            }),
          );
    const sharesChosen = sharesVariants.find(({ tfidf: t }) => sharesName(t) === ruleB?.chosen);
    if (sharesChosen !== undefined) {
      current = { ...current, tfidf: sharesChosen.tfidf };
      currentIndex = buildContentIndex(rows, current.tfidf, shelfTags);
    }

    // Regra c, por pares: os três modos na base; cada valor da grade calcula só o modo dele, e cada
    // par junta as listas dos dois modos.
    const lambdaBase = !runs('c')
      ? null
      : run('regra c: atual', currentIndex, current.scoring, rated, MODES.map(listOf));
    let lambdaFinal = lambdaBase;
    let ruleC: RuleResult | null = null;
    if (lambdaBase !== null) {
      const lambdas = current.scoring.popularityWeightByMode;
      const listsByValue = (mode: typeof DiscoveryMode.DISCOVERY | typeof DiscoveryMode.POPULAR) =>
        new Map([
          [lambdas[mode], lambdaBase],
          ...variantsOf('lambda', evaluation, current.tfidf, current.scoring)
            .filter((variant) => variant.mode === mode)
            .map((variant) => {
              const value = variant.scoring.popularityWeightByMode[mode];
              const name = `regra c: ${mode} ${decimalName('λ = ', value)}`;
              return [
                value,
                run(name, currentIndex, variant.scoring, rated, [listOf(mode)]),
              ] as const;
            }),
        ]);
      const discoveryLists = listsByValue(DiscoveryMode.DISCOVERY);
      const popularLists = listsByValue(DiscoveryMode.POPULAR);
      const pairName = ({ discovery, popular }: LambdaPair) =>
        `${decimalName('', discovery)}; ${decimalName('', popular)}`;
      const pairs = [...discoveryLists].flatMap(([discovery, withDiscovery]) =>
        [...popularLists].map(([popular, withPopular]) => {
          const pair = { discovery, popular };
          const outcomes = mergeOutcomes(
            mergeOutcomes(lambdaBase, withDiscovery, [listOf(DiscoveryMode.DISCOVERY)]),
            withPopular,
            [listOf(DiscoveryMode.POPULAR)],
          );
          return { pair, outcomes, name: pairName(pair) };
        }),
      );
      ruleC = lambdaPairRule(
        pairName({ discovery: lambdas.DISCOVERY, popular: lambdas.POPULAR }),
        pairs.map(({ pair, outcomes, name }, i) => {
          console.log(`regra c: condições do par ${name} (${i + 1} de ${pairs.length})`);
          return {
            ...candidate(
              name,
              null,
              lambdaPairChecks(outcomes, evaluation, bootstrap, catalogSize),
            ),
            pair,
          };
        }),
      );
      const chosen = pairs.find(({ name }) => name === ruleC!.chosen)!;
      lambdaFinal = chosen.outcomes;
      current = {
        ...current,
        scoring: {
          ...current.scoring,
          popularityWeightByMode: {
            ...lambdas,
            DISCOVERY: chosen.pair.discovery,
            POPULAR: chosen.pair.popular,
          },
        },
      };
    }

    // Regra d: o modo da regra, na família C.
    const weightMethods = [listOf(evaluation.rules.preferenceWeight.mode)];
    const weightBase = !runs('d')
      ? null
      : run('regra d: atual', currentIndex, current.scoring, coldStart, weightMethods);
    const weightVariants = variantsOf(
      'preferenceWeight',
      evaluation,
      current.tfidf,
      current.scoring,
    );
    const weightName = (weight: number) => decimalName('β = ', weight);
    const ruleD =
      weightBase === null
        ? null
        : preferenceWeightRule(
            candidate(
              weightName(current.scoring.preferenceWeight),
              current.scoring.preferenceWeight,
              preferenceWeightChecks(weightBase, null, evaluation, bootstrap),
            ),
            weightVariants.map((variant) => {
              const name = weightName(variant.scoring.preferenceWeight);
              const outcomes = run(
                `regra d: ${name}`,
                currentIndex,
                variant.scoring,
                coldStart,
                weightMethods,
              );
              return {
                ...candidate(
                  name,
                  variant.scoring.preferenceWeight,
                  preferenceWeightChecks(weightBase, outcomes, evaluation, bootstrap),
                ),
                criteria: criteriaFor(currentIndex, variant.scoring),
              };
            }),
          );
    const weightChosen = weightVariants.find(
      ({ scoring: variantScoring }) =>
        weightName(variantScoring.preferenceWeight) === ruleD?.chosen,
    );
    if (weightChosen !== undefined) {
      current = {
        ...current,
        scoring: { ...current.scoring, preferenceWeight: weightChosen.scoring.preferenceWeight },
      };
    }

    const rules = [ruleA, ruleB, ruleC, ruleD].filter((rule) => rule !== null);
    const { popularityWeightByMode: lambdas } = current.scoring;
    const chosen = {
      'Limite das prateleiras': limitName(current.scoring.lists.specificMaxDocumentRatio),
      'Fatias e normalização': sharesName(current.tfidf),
      'λ do Populares': decimalName('', lambdas.POPULAR),
      'λ do Equilibrado': decimalName('', lambdas.BALANCED),
      'λ do Descobertas': decimalName('', lambdas.DISCOVERY),
      β: decimalName('', current.scoring.preferenceWeight),
    };
    const upcoming =
      lambdaFinal === null ? [] : upcomingRecords(lambdaFinal, evaluation, catalogSize);
    write(
      { rules, upcoming, chosen, tfidf: current.tfidf, scoring: current.scoring },
      (finalMeta) =>
        renderRound2({
          title: `Avaliação offline: rodada 2, calibração${only === null ? '' : `, só a regra ${only}`}`,
          meta: finalMeta,
          rules,
          upcoming,
          chosen,
        }),
    );
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = args.indexOf('--round');
  const round = flag >= 0 ? Number(args[flag + 1]) : 1;
  if (round !== 1 && round !== 2) {
    throw new Error(`Rodada desconhecida: ${args[flag + 1]}. Use 1 ou 2.`);
  }
  const ruleFlag = args.indexOf('--rule');
  const only = ruleFlag >= 0 ? (args[ruleFlag + 1] as Rule) : null;
  if (only !== null && (round !== 2 || !RULES.includes(only))) {
    throw new Error(`Regra desconhecida: ${only}. Use --round 2 --rule ${RULES.join('|')}.`);
  }
  const values = new Set([flag, ruleFlag].filter((i) => i >= 0).map((i) => i + 1));
  const out = args.find((arg, i) => !arg.startsWith('--') && !values.has(i));
  void evaluate(out ?? 'avaliacao', round, only);
}
