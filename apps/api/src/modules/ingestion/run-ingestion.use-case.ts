import { Logger } from '@nestjs/common';
import { IngestionStatus, ReviewFlagKind } from '../../generated/prisma/client';
import { canDeactivateMissing, missingCause } from './review-flags/candidate-set';
import type { IgdbCatalogSource } from './igdb/igdb-catalog.source';
import { igdbGameSchema } from './igdb/igdb-game.schema';
import { type MappedGame, mapIgdbGame } from './igdb/igdb.mapper';
import { evaluateIndieCriteria } from './criteria/indie-criteria';
import type { VersionedIndieCriteria } from './criteria/indie-criteria.config';
import type { IngestionConfig } from './ingestion-config';
import type {
  CatalogGame,
  IngestionRepository,
  OutOfCatalogGame,
  RunOutcome,
} from './persistence/ingestion.repository';
import { normalizedPopularity, popularityScale, reconstructedCount } from './popularity/popularity';
import {
  detectReviewFlags,
  type EvaluatedGame,
  type ReviewFlag,
  type StoredGame,
} from './review-flags/review-flags';
import { resolveStudioCountry, type WikidataCountries } from './studio-country/studio-country';
import type { WikidataCountrySource } from './wikidata/wikidata-country.source';
import { computeIdf, type TfidfConfig, tfidfVector } from '../recommendation/tfidf';

export interface IngestionSettings {
  criteria: VersionedIndieCriteria;
  tfidf: TfidfConfig;
  ingestion: IngestionConfig;
}

export interface IngestionResult extends RunOutcome {
  runId: string;
}

type Counts = Pick<RunOutcome, 'gamesFetched' | 'gamesInvalid'>;

interface WikidataLookup {
  countriesOf: (game: MappedGame) => WikidataCountries | undefined;
  unavailableReason?: string;
}

interface Deactivation {
  games: OutOfCatalogGame[];
  flags: ReviewFlag[];
  skippedReason?: string;
}

// Busca o conjunto candidato inteiro, reavalia todo jogo já gravado e grava tudo numa transação.
// Qualquer falha antes da gravação deixa o banco como estava, com a execução registrada como FAILED.
export class RunIngestionUseCase {
  private readonly logger = new Logger(RunIngestionUseCase.name);

  constructor(
    private readonly source: IgdbCatalogSource,
    private readonly wikidata: WikidataCountrySource,
    private readonly repository: IngestionRepository,
    private readonly settings: IngestionSettings,
  ) {}

  async execute(now = new Date()): Promise<IngestionResult> {
    const runId = await this.repository.startRun(this.settings.criteria.version, now);
    const counts: Counts = { gamesFetched: 0, gamesInvalid: 0 };
    try {
      const outcome = await this.ingest(runId, now, counts);
      await this.repository.finishRun(runId, outcome);
      this.logger.log(
        `Ingestão concluída: ${outcome.gamesUpserted} no catálogo, ${outcome.flagsRaised} alertas`,
      );
      return { runId, ...outcome };
    } catch (error) {
      const outcome: RunOutcome = {
        status: IngestionStatus.FAILED,
        ...counts,
        gamesUpserted: 0,
        gamesRejected: 0,
        gamesDeactivated: 0,
        flagsRaised: 0,
        errorSummary: error instanceof Error ? error.message : String(error),
      };
      await this.repository.finishRun(runId, outcome);
      this.logger.error(`Ingestão falhou: ${outcome.errorSummary}`);
      return { runId, ...outcome };
    }
  }

  private async ingest(runId: string, now: Date, counts: Counts): Promise<RunOutcome> {
    const { criteria, version } = this.settings.criteria;
    const previous = await this.repository.lastSucceededRun();
    const stored = await this.repository.storedGames(previous);
    const { evaluated, fetchedIds } = await this.evaluateCandidates(now, stored, counts);

    const catalogEntries = evaluated.filter((e) => e.verdict.accepted);
    const companies = await this.source.companyGraph(
      catalogEntries.flatMap(({ game }) =>
        game.companies.filter((c) => c.isDeveloper).map((c) => c.igdbId),
      ),
    );
    const wantToPlay = await this.source.wantToPlay(catalogEntries.map(({ game }) => game.igdbId));
    const scale = popularityScale(wantToPlay.values());
    const countries = await this.wikidataCountries();

    const missing = [...stored.values()].filter((g) => g.inCatalog && !fetchedIds.has(g.igdbId));
    const deactivation = await this.planDeactivation(
      missing,
      counts.gamesFetched,
      previous?.gamesFetched ?? null,
    );

    const idf = computeIdf(
      catalogEntries.map(({ game }) => game.features),
      this.settings.tfidf,
    );
    const catalog: CatalogGame[] = catalogEntries.map(({ game, verdict }) => {
      const count = reconstructedCount(wantToPlay.get(game.igdbId) ?? 0, scale);
      return {
        game,
        verdict,
        popularityCount: count,
        popularityNorm: normalizedPopularity(count, scale),
        studioCountry: resolveStudioCountry(game.studioCountryCode, countries.countriesOf(game)),
        weights: tfidfVector(game.features, idf, this.settings.tfidf).weights,
      };
    });
    const outOfCatalog: OutOfCatalogGame[] = [
      ...evaluated
        .filter((e) => !e.verdict.accepted)
        .map(({ game, verdict }) => ({
          igdbId: game.igdbId,
          verdict,
          firstReleaseDate: game.firstReleaseDate,
          releaseStatus: game.releaseStatus,
        })),
      ...deactivation.games,
    ];
    const flags = [
      ...detectReviewFlags({
        evaluated,
        stored,
        companies,
        criteria,
        criteriaVersion: version,
        now,
      }),
      ...deactivation.flags,
    ];

    const writeStart = Date.now();
    await this.repository.writeCatalog(runId, {
      criteriaVersion: version,
      evaluatedAt: now,
      catalog,
      outOfCatalog,
      idf,
      flags,
    });
    this.logger.log(`Gravação concluída em ${Math.round((Date.now() - writeStart) / 1000)} s`);
    return {
      status: IngestionStatus.SUCCEEDED,
      ...counts,
      gamesUpserted: catalog.length,
      gamesRejected: counts.gamesFetched - counts.gamesInvalid - catalog.length,
      gamesDeactivated: deactivation.games.length,
      flagsRaised: flags.length,
      popularityUnit: scale?.unit ?? null,
      popularityMax: scale?.maxCount ?? null,
      popularityMedian: scale?.medianCount ?? null,
      errorSummary:
        [deactivation.skippedReason, countries.unavailableReason].filter(Boolean).join('; ') ||
        null,
    };
  }

  // País do estúdio pelo Wikidata, para os jogos sem país na IGDB. Se o Wikidata falhar, a
  // ingestão segue e mantém os países que já tinham vindo dele, com o motivo no resumo.
  private async wikidataCountries(): Promise<WikidataLookup> {
    try {
      const bySlug = await this.wikidata.countriesBySlug();
      return { countriesOf: (game) => bySlug.get(game.slug) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`País pelo Wikidata indisponível: ${reason}`);
      const previous = await this.repository.wikidataCountries();
      return {
        countriesOf: (game) => {
          const code = previous.get(game.igdbId);
          return code === undefined ? undefined : { developer: new Set([code]), origin: new Set() };
        },
        unavailableReason: `${reason}; países do Wikidata mantidos da execução anterior`,
      };
    }
  }

  // Guarda o jogo completo só quando ele vai para o catálogo ou já estava gravado: o conjunto
  // candidato tem cerca de 130 mil jogos, e a maioria é rejeitada sem nunca ter sido gravada.
  private async evaluateCandidates(
    now: Date,
    stored: ReadonlyMap<number, StoredGame>,
    counts: Counts,
  ) {
    const { criteria } = this.settings.criteria;
    const evaluated: EvaluatedGame[] = [];
    const fetchedIds = new Set<number>();
    for await (const page of this.source.candidates()) {
      for (const record of page) {
        counts.gamesFetched++;
        fetchedIds.add(record.id);
        const parsed = igdbGameSchema.safeParse(record);
        if (!parsed.success) {
          counts.gamesInvalid++;
          continue;
        }
        const game: MappedGame = mapIgdbGame(parsed.data, now);
        const verdict = evaluateIndieCriteria(game, criteria, now, {
          wasInCatalog: stored.get(game.igdbId)?.inCatalog ?? false,
        });
        if (verdict.accepted || stored.has(game.igdbId)) evaluated.push({ game, verdict });
      }
      this.logger.log(`${counts.gamesFetched} jogos buscados`);
    }

    const { maxInvalidRatio } = this.settings.ingestion;
    if (counts.gamesInvalid > counts.gamesFetched * maxInvalidRatio) {
      throw new Error(
        `${counts.gamesInvalid} de ${counts.gamesFetched} jogos falharam no schema da IGDB, ` +
          `acima do teto de ${maxInvalidRatio * 100}%; nada foi gravado`,
      );
    }
    return { evaluated, fetchedIds };
  }

  private async planDeactivation(
    missing: StoredGame[],
    fetched: number,
    previousFetched: number | null,
  ): Promise<Deactivation> {
    const none: Deactivation = { games: [], flags: [] };
    if (missing.length === 0) return none;

    const { minFetchedRatioToDeactivate } = this.settings.ingestion;
    if (!canDeactivateMissing(fetched, previousFetched, minFetchedRatioToDeactivate)) {
      return {
        ...none,
        skippedReason:
          `${missing.length} jogos do catálogo não voltaram na busca, mas a busca trouxe ` +
          `${fetched} jogos contra ${previousFetched} da última execução: nenhum foi desativado`,
      };
    }

    const scope = await this.source.scope(missing.map((g) => g.igdbId));
    const { indieGenre } = this.settings.criteria.criteria;
    const left = missing.map((game) => ({
      game,
      cause: missingCause(scope.get(game.igdbId), indieGenre.igdbId),
    }));
    const games = left.map(({ game, cause }) => ({
      igdbId: game.igdbId,
      verdict: { accepted: false, reason: 'LEFT_CANDIDATE_SET', cause },
    }));
    const flags = left.map(({ game, cause }) => ({
      kind: ReviewFlagKind.LEFT_CANDIDATE_SET,
      igdbId: game.igdbId,
      gameName: game.name,
      detail: { cause },
    }));
    return { games, flags };
  }
}
