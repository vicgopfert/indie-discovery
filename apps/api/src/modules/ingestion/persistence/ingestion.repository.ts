import { IngestionStatus, type Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { MappedGame } from '../igdb/igdb.mapper';
import type { ReviewFlag, StoredGame } from '../review-flags/review-flags';
import type { FeatureKey } from '../../recommendation/tfidf';

export interface CatalogGame {
  game: MappedGame;
  verdict: unknown;
  popularityRaw: number;
  popularityNorm: number;
  weights: ReadonlyMap<FeatureKey, number>;
}

export interface OutOfCatalogGame {
  igdbId: number;
  verdict: unknown;
  firstReleaseDate?: Date | null;
  releaseStatus?: MappedGame['releaseStatus'];
}

export interface CatalogWrite {
  criteriaVersion: string;
  evaluatedAt: Date;
  catalog: CatalogGame[];
  outOfCatalog: OutOfCatalogGame[];
  idf: ReadonlyMap<FeatureKey, number>;
  flags: ReviewFlag[];
}

export interface RunOutcome {
  status: IngestionStatus;
  gamesFetched: number;
  gamesUpserted: number;
  gamesRejected: number;
  gamesInvalid: number;
  gamesDeactivated: number;
  flagsRaised: number;
  popularityUnit?: number | null;
  popularityMax?: number | null;
  popularityMedian?: number | null;
  errorSummary?: string | null;
}

export interface PreviousRun {
  gamesFetched: number;
  evaluatedAt: Date;
}

// Lotes por comando: arrays enormes num único parâmetro pesam no banco remoto.
const ROWS_PER_STATEMENT = 5000;
const GAMES_PER_LINK_STATEMENT = 2000;

// A transação cobre só a gravação, que leva cerca de um minuto para o catálogo inteiro; a busca e
// o cálculo acontecem antes dela. O padrão do Prisma (5 s) não comporta essa gravação.
const WRITE_TIMEOUT_MS = 5 * 60_000;

const day = (date: Date | null | undefined) => date?.toISOString().slice(0, 10) ?? null;

// Cada execução reavalia o catálogo inteiro, mas só regrava a linha que mudou: no PostgreSQL,
// toda atualização deixa uma linha morta, e o banco gratuito tem 1 GB.
export class IngestionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async startRun(criteriaVersion: string, evaluatedAt: Date) {
    const run = await this.prisma.ingestionRun.create({ data: { criteriaVersion, evaluatedAt } });
    return run.id;
  }

  async finishRun(runId: string, outcome: RunOutcome) {
    await this.prisma.ingestionRun.update({
      where: { id: runId },
      data: { ...outcome, finishedAt: new Date() },
    });
  }

  async lastSucceededRun(): Promise<PreviousRun | null> {
    return this.prisma.ingestionRun.findFirst({
      where: { status: IngestionStatus.SUCCEEDED },
      orderBy: { startedAt: 'desc' },
      select: { gamesFetched: true, evaluatedAt: true },
    });
  }

  // Todo jogo gravado foi avaliado pela última execução bem-sucedida, então a data dela é a da
  // avaliação anterior de cada um.
  async storedGames(previous: PreviousRun | null) {
    const rows = await this.prisma.game.findMany({
      select: {
        igdbId: true,
        name: true,
        inCatalog: true,
        firstReleaseDate: true,
        criteriaVersion: true,
        syncedAt: true,
      },
    });
    return new Map<number, StoredGame>(
      rows.map(({ syncedAt, ...row }) => [
        row.igdbId,
        { ...row, evaluatedAt: previous?.evaluatedAt ?? syncedAt },
      ]),
    );
  }

  // Tudo numa transação: se um comando falhar, o banco fica como estava e a próxima execução refaz.
  async writeCatalog(runId: string, write: CatalogWrite) {
    await this.prisma.$transaction(
      [
        ...this.upsertCompanies(write.catalog),
        ...this.upsertFeatures(write),
        ...this.upsertCatalogGames(write),
        ...this.markOutOfCatalog(write),
        this.prisma.$executeRaw`
          UPDATE "GameFeature" gf SET "tfidfWeight" = 0
          FROM "Game" g WHERE g."id" = gf."gameId" AND NOT g."inCatalog" AND gf."tfidfWeight" <> 0`,
        ...this.syncGameCompanies(write.catalog),
        ...this.syncGameFeatures(write.catalog),
        ...this.syncGameLanguages(write.catalog),
        ...this.insertFlags(runId, write.flags),
      ],
      { timeout: WRITE_TIMEOUT_MS },
    );
  }

  private upsertCompanies(catalog: CatalogGame[]) {
    const companies = new Map(
      catalog.flatMap(({ game }) => game.companies.map((c) => [c.igdbId, c] as const)),
    );
    return chunked(
      [...companies.values()],
      (rows) => this.prisma.$executeRaw`
      INSERT INTO "Company" AS co ("id", "igdbId", "name", "countryCode")
      SELECT gen_random_uuid(), t.igdb_id, t.name, c."code"
      FROM unnest(
        ${rows.map((r) => r.igdbId)}::int[],
        ${rows.map((r) => r.name)}::text[],
        ${rows.map((r) => r.countryCode)}::int[]
      ) AS t(igdb_id, name, country_code)
      LEFT JOIN "Country" c ON c."code" = t.country_code
      ON CONFLICT ("igdbId") DO UPDATE
      SET "name" = EXCLUDED."name", "countryCode" = EXCLUDED."countryCode"
      WHERE (co."name", co."countryCode") IS DISTINCT FROM (EXCLUDED."name", EXCLUDED."countryCode")`,
    );
  }

  private upsertFeatures({ catalog, idf }: CatalogWrite) {
    const features = new Map(
      catalog.flatMap(({ game }) =>
        game.features.map((f) => [`${f.type}:${f.igdbId}`, f] as const),
      ),
    );
    const rows = [...features].map(([key, f]) => ({ ...f, idf: idf.get(key) ?? 0 }));
    return [
      this.prisma.$executeRaw`
        UPDATE "Feature" f SET "idf" = 0
        WHERE f."idf" <> 0 AND NOT EXISTS (
          SELECT 1 FROM unnest(
            ${rows.map((r) => r.type)}::text[],
            ${rows.map((r) => r.igdbId)}::int[]
          ) AS t(type, igdb_id)
          WHERE f."type" = t.type::"FeatureType" AND f."igdbId" = t.igdb_id
        )`,
      ...chunked(
        rows,
        (batch) => this.prisma.$executeRaw`
        INSERT INTO "Feature" AS fe ("id", "type", "igdbId", "name", "slug", "idf")
        SELECT gen_random_uuid(), t.type::"FeatureType", t.igdb_id, t.name, t.slug, t.idf
        FROM unnest(
          ${batch.map((f) => f.type)}::text[],
          ${batch.map((f) => f.igdbId)}::int[],
          ${batch.map((f) => f.name)}::text[],
          ${batch.map((f) => f.slug)}::text[],
          ${batch.map((f) => f.idf)}::float8[]
        ) AS t(type, igdb_id, name, slug, idf)
        ON CONFLICT ("type", "igdbId") DO UPDATE
        SET "name" = EXCLUDED."name", "slug" = EXCLUDED."slug", "idf" = EXCLUDED."idf"
        WHERE (fe."name", fe."slug", fe."idf") IS DISTINCT FROM
          (EXCLUDED."name", EXCLUDED."slug", EXCLUDED."idf")`,
      ),
    ];
  }

  // syncedAt é a data da última mudança da linha, não da última avaliação.
  private upsertCatalogGames({ catalog, criteriaVersion, evaluatedAt }: CatalogWrite) {
    return chunked(
      catalog,
      (rows) => this.prisma.$executeRaw`
      INSERT INTO "Game" AS g (
        "id", "igdbId", "slug", "name", "summary", "coverImageId", "firstReleaseDate",
        "releaseStatus", "popularityRaw", "popularityNorm", "inCatalog", "storeUrl",
        "studioCountryCode", "studioCountrySource", "syncedAt", "criteriaVerdict", "criteriaVersion"
      )
      SELECT gen_random_uuid(), t.igdb_id, t.slug, t.name, t.summary, t.cover, t.released::date,
        t.status::"ReleaseStatus", t.raw, t.norm, true, t.store, c."code",
        CASE WHEN c."code" IS NULL THEN NULL ELSE 'IGDB'::"StudioCountrySource" END,
        ${evaluatedAt}, t.verdict::jsonb, ${criteriaVersion}
      FROM unnest(
        ${rows.map((r) => r.game.igdbId)}::int[],
        ${rows.map((r) => r.game.slug)}::text[],
        ${rows.map((r) => r.game.name)}::text[],
        ${rows.map((r) => r.game.summary)}::text[],
        ${rows.map((r) => r.game.coverImageId)}::text[],
        ${rows.map((r) => day(r.game.firstReleaseDate))}::text[],
        ${rows.map((r) => r.game.releaseStatus)}::text[],
        ${rows.map((r) => r.popularityRaw)}::float8[],
        ${rows.map((r) => r.popularityNorm)}::float8[],
        ${rows.map((r) => r.game.storeUrl)}::text[],
        ${rows.map((r) => r.game.studioCountryCode)}::int[],
        ${rows.map((r) => JSON.stringify(r.verdict))}::text[]
      ) AS t(igdb_id, slug, name, summary, cover, released, status, raw, norm, store, country, verdict)
      LEFT JOIN "Country" c ON c."code" = t.country
      ON CONFLICT ("igdbId") DO UPDATE SET
        "slug" = EXCLUDED."slug", "name" = EXCLUDED."name", "summary" = EXCLUDED."summary",
        "coverImageId" = EXCLUDED."coverImageId", "firstReleaseDate" = EXCLUDED."firstReleaseDate",
        "releaseStatus" = EXCLUDED."releaseStatus", "popularityRaw" = EXCLUDED."popularityRaw",
        "popularityNorm" = EXCLUDED."popularityNorm", "inCatalog" = true,
        "storeUrl" = EXCLUDED."storeUrl", "studioCountryCode" = EXCLUDED."studioCountryCode",
        "studioCountrySource" = EXCLUDED."studioCountrySource", "syncedAt" = EXCLUDED."syncedAt",
        "criteriaVerdict" = EXCLUDED."criteriaVerdict", "criteriaVersion" = EXCLUDED."criteriaVersion"
      WHERE (
        g."slug", g."name", g."summary", g."coverImageId", g."firstReleaseDate", g."releaseStatus",
        g."popularityRaw", g."popularityNorm", g."inCatalog", g."storeUrl", g."studioCountryCode",
        g."studioCountrySource", g."criteriaVerdict", g."criteriaVersion"
      ) IS DISTINCT FROM (
        EXCLUDED."slug", EXCLUDED."name", EXCLUDED."summary", EXCLUDED."coverImageId",
        EXCLUDED."firstReleaseDate", EXCLUDED."releaseStatus", EXCLUDED."popularityRaw",
        EXCLUDED."popularityNorm", true, EXCLUDED."storeUrl", EXCLUDED."studioCountryCode",
        EXCLUDED."studioCountrySource", EXCLUDED."criteriaVerdict", EXCLUDED."criteriaVersion"
      )`,
    );
  }

  // Jogo que sai do catálogo não é apagado: avaliações e listas de usuários apontam para ele.
  private markOutOfCatalog({ outOfCatalog, criteriaVersion, evaluatedAt }: CatalogWrite) {
    return chunked(
      outOfCatalog,
      (rows) => this.prisma.$executeRaw`
      UPDATE "Game" g SET
        "inCatalog" = false,
        "criteriaVerdict" = n.verdict,
        "criteriaVersion" = ${criteriaVersion},
        "syncedAt" = ${evaluatedAt},
        "firstReleaseDate" = n.released,
        "releaseStatus" = n.status
      FROM (
        SELECT t.igdb_id, t.verdict::jsonb AS verdict,
          CASE WHEN t.refreshed THEN t.released::date ELSE g2."firstReleaseDate" END AS released,
          COALESCE(t.status::"ReleaseStatus", g2."releaseStatus") AS status
        FROM unnest(
          ${rows.map((r) => r.igdbId)}::int[],
          ${rows.map((r) => JSON.stringify(r.verdict))}::text[],
          ${rows.map((r) => r.firstReleaseDate !== undefined)}::bool[],
          ${rows.map((r) => day(r.firstReleaseDate))}::text[],
          ${rows.map((r) => r.releaseStatus ?? null)}::text[]
        ) AS t(igdb_id, verdict, refreshed, released, status)
        JOIN "Game" g2 ON g2."igdbId" = t.igdb_id
      ) AS n
      WHERE g."igdbId" = n.igdb_id
        AND (g."inCatalog", g."criteriaVerdict", g."criteriaVersion", g."firstReleaseDate", g."releaseStatus")
          IS DISTINCT FROM (false, n.verdict, ${criteriaVersion}, n.released, n.status)`,
    );
  }

  // Ligações por diferença: apaga a que saiu, insere a que falta e atualiza a que mudou.
  private syncGameCompanies(catalog: CatalogGame[]) {
    return chunked(
      catalog,
      (games) => {
        const ids = games.map(({ game }) => game.igdbId);
        const rows = games.flatMap(({ game }) =>
          game.companies.map((c) => ({ gameId: game.igdbId, ...c })),
        );
        const gameIds = rows.map((r) => r.gameId);
        const companyIds = rows.map((r) => r.igdbId);
        return [
          this.prisma.$executeRaw`
          DELETE FROM "GameCompany" gc USING "Game" g, "Company" c
          WHERE gc."gameId" = g."id" AND gc."companyId" = c."id" AND g."igdbId" = ANY(${ids}::int[])
            AND NOT EXISTS (
              SELECT 1 FROM unnest(${gameIds}::int[], ${companyIds}::int[]) AS t(game_id, company_id)
              WHERE t.game_id = g."igdbId" AND t.company_id = c."igdbId"
            )`,
          this.prisma.$executeRaw`
          INSERT INTO "GameCompany" AS gc ("gameId", "companyId", "isDeveloper", "isPublisher")
          SELECT g."id", c."id", t.developer, t.publisher
          FROM unnest(
            ${gameIds}::int[],
            ${companyIds}::int[],
            ${rows.map((r) => r.isDeveloper)}::bool[],
            ${rows.map((r) => r.isPublisher)}::bool[]
          ) AS t(game_id, company_id, developer, publisher)
          JOIN "Game" g ON g."igdbId" = t.game_id
          JOIN "Company" c ON c."igdbId" = t.company_id
          ON CONFLICT ("gameId", "companyId") DO UPDATE
          SET "isDeveloper" = EXCLUDED."isDeveloper", "isPublisher" = EXCLUDED."isPublisher"
          WHERE (gc."isDeveloper", gc."isPublisher") IS DISTINCT FROM
            (EXCLUDED."isDeveloper", EXCLUDED."isPublisher")`,
        ];
      },
      GAMES_PER_LINK_STATEMENT,
    );
  }

  private syncGameFeatures(catalog: CatalogGame[]) {
    return chunked(
      catalog,
      (games) => {
        const ids = games.map(({ game }) => game.igdbId);
        const rows = games.flatMap(({ game, weights }) =>
          game.features.map((f) => ({
            gameId: game.igdbId,
            ...f,
            weight: weights.get(`${f.type}:${f.igdbId}`) ?? 0,
          })),
        );
        const gameIds = rows.map((r) => r.gameId);
        const types = rows.map((r) => r.type);
        const featureIds = rows.map((r) => r.igdbId);
        return [
          this.prisma.$executeRaw`
          DELETE FROM "GameFeature" gf USING "Game" g, "Feature" f
          WHERE gf."gameId" = g."id" AND gf."featureId" = f."id" AND g."igdbId" = ANY(${ids}::int[])
            AND NOT EXISTS (
              SELECT 1 FROM unnest(${gameIds}::int[], ${types}::text[], ${featureIds}::int[])
                AS t(game_id, type, feature_id)
              WHERE t.game_id = g."igdbId" AND t.type::"FeatureType" = f."type"
                AND t.feature_id = f."igdbId"
            )`,
          this.prisma.$executeRaw`
          INSERT INTO "GameFeature" AS gf ("gameId", "featureId", "tfidfWeight")
          SELECT g."id", f."id", t.weight
          FROM unnest(
            ${gameIds}::int[],
            ${types}::text[],
            ${featureIds}::int[],
            ${rows.map((r) => r.weight)}::float8[]
          ) AS t(game_id, type, feature_id, weight)
          JOIN "Game" g ON g."igdbId" = t.game_id
          JOIN "Feature" f ON f."type" = t.type::"FeatureType" AND f."igdbId" = t.feature_id
          ON CONFLICT ("gameId", "featureId") DO UPDATE
          SET "tfidfWeight" = EXCLUDED."tfidfWeight"
          WHERE gf."tfidfWeight" IS DISTINCT FROM EXCLUDED."tfidfWeight"`,
        ];
      },
      GAMES_PER_LINK_STATEMENT,
    );
  }

  // Idioma fora do seed fica de fora: a ficha só mostra idiomas conhecidos.
  private syncGameLanguages(catalog: CatalogGame[]) {
    return chunked(
      catalog,
      (games) => {
        const ids = games.map(({ game }) => game.igdbId);
        const rows = games.flatMap(({ game }) =>
          game.languages.map((l) => ({ gameId: game.igdbId, ...l })),
        );
        const gameIds = rows.map((r) => r.gameId);
        const languageIds = rows.map((r) => r.languageIgdbId);
        return [
          this.prisma.$executeRaw`
          DELETE FROM "GameLanguage" gl USING "Game" g, "Language" l
          WHERE gl."gameId" = g."id" AND gl."languageId" = l."id" AND g."igdbId" = ANY(${ids}::int[])
            AND NOT EXISTS (
              SELECT 1 FROM unnest(${gameIds}::int[], ${languageIds}::int[]) AS t(game_id, language_id)
              WHERE t.game_id = g."igdbId" AND t.language_id = l."igdbId"
            )`,
          this.prisma.$executeRaw`
          INSERT INTO "GameLanguage" AS gl ("gameId", "languageId", "interface", "subtitles", "audio")
          SELECT g."id", l."id", t.interface, t.subtitles, t.audio
          FROM unnest(
            ${gameIds}::int[],
            ${languageIds}::int[],
            ${rows.map((r) => r.interface)}::bool[],
            ${rows.map((r) => r.subtitles)}::bool[],
            ${rows.map((r) => r.audio)}::bool[]
          ) AS t(game_id, language_id, interface, subtitles, audio)
          JOIN "Game" g ON g."igdbId" = t.game_id
          JOIN "Language" l ON l."igdbId" = t.language_id
          ON CONFLICT ("gameId", "languageId") DO UPDATE
          SET "interface" = EXCLUDED."interface", "subtitles" = EXCLUDED."subtitles",
            "audio" = EXCLUDED."audio"
          WHERE (gl."interface", gl."subtitles", gl."audio") IS DISTINCT FROM
            (EXCLUDED."interface", EXCLUDED."subtitles", EXCLUDED."audio")`,
        ];
      },
      GAMES_PER_LINK_STATEMENT,
    );
  }

  private insertFlags(runId: string, flags: ReviewFlag[]) {
    return chunked(
      flags,
      (rows) => this.prisma.$executeRaw`
      INSERT INTO "IngestionReviewFlag" ("id", "runId", "kind", "igdbId", "gameName", "detail")
      SELECT gen_random_uuid(), ${runId}::uuid, t.kind::"ReviewFlagKind", t.igdb_id, t.name, t.detail::jsonb
      FROM unnest(
        ${rows.map((r) => r.kind)}::text[],
        ${rows.map((r) => r.igdbId)}::int[],
        ${rows.map((r) => r.gameName)}::text[],
        ${rows.map((r) => JSON.stringify(r.detail))}::text[]
      ) AS t(kind, igdb_id, name, detail)`,
    );
  }
}

type Statement = Prisma.PrismaPromise<number>;

function chunked<T>(
  rows: T[],
  statement: (batch: T[]) => Statement | Statement[],
  size = ROWS_PER_STATEMENT,
) {
  const statements: Statement[] = [];
  for (let start = 0; start < rows.length; start += size) {
    statements.push(...[statement(rows.slice(start, start + size))].flat());
  }
  return statements;
}
