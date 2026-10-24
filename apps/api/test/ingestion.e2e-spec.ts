import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seedReferenceData } from '../prisma/seed/reference-data';
import { AppModule } from '../src/app.module';
import { IngestionStatus, ReviewFlagKind } from '../src/generated/prisma/client';
import { IgdbCatalogSource } from '../src/modules/ingestion/igdb/igdb-catalog.source';
import { igdbGameSchema } from '../src/modules/ingestion/igdb/igdb-game.schema';
import { mapIgdbGame } from '../src/modules/ingestion/igdb/igdb.mapper';
import { IgdbClient } from '../src/modules/ingestion/igdb/igdb.client';
import { evaluateIndieCriteria } from '../src/modules/ingestion/criteria/indie-criteria';
import { readVersionedIndieCriteria } from '../src/modules/ingestion/criteria/indie-criteria.config';
import { readIngestionConfig } from '../src/modules/ingestion/ingestion-config';
import { IngestionRepository } from '../src/modules/ingestion/persistence/ingestion.repository';
import { RunIngestionUseCase } from '../src/modules/ingestion/run-ingestion.use-case';
import { WikidataCountrySource } from '../src/modules/ingestion/wikidata/wikidata-country.source';
import { readTfidfConfig } from '../src/modules/recommendation/tfidf';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeIgdbServer, type ReceivedRequest } from './support/fake-igdb-server';

type RawGame = {
  id: number;
  name?: string;
  summary?: string;
  first_release_date?: number;
} & Record<string, unknown>;

const NOW = new Date('2026-10-23T00:00:00Z');
const UNIT = 0.000001134116025;
const BEHAVIOUR = 1260;
const FRICTIONAL = 36;
const SCOTTGAMES = 8653;
const fixtureGames = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/igdb/games.complete.json'), 'utf8'),
) as RawGame[];
const versioned = readVersionedIndieCriteria();
const accepted = fixtureGames.filter(
  (raw) =>
    evaluateIndieCriteria(mapIgdbGame(igdbGameSchema.parse(raw), NOW), versioned.criteria, NOW)
      .accepted,
);

// Vários jogos com contagem 1, como no catálogo real: a menor fração é a de uma pessoa.
const wantToPlayCounts = accepted.map((_, i) => (i % 4) + 1);
const sortedCounts = [...wantToPlayCounts].sort((a, b) => a - b);
const middle = Math.floor(sortedCounts.length / 2);
const medianCount =
  sortedCounts.length % 2 === 1
    ? sortedCounts[middle]!
    : (sortedCounts[middle - 1]! + sortedCounts[middle]!) / 2;

const idsIn = (body: string, field: string) =>
  (new RegExp(`${field} = \\(([\\d,]+)\\)`).exec(body)?.[1] ?? '').split(',').map(Number);

class FakeCatalog {
  games: RawGame[] = structuredClone(fixtureGames);
  companies = new Map<number, { name: string; parent?: number }>([
    [FRICTIONAL, { name: 'Frictional Games', parent: BEHAVIOUR }],
    [BEHAVIOUR, { name: 'Behaviour Interactive' }],
  ]);
  wantToPlay = new Map(accepted.map((g, i) => [g.id, wantToPlayCounts[i]! * UNIT]));
  wikidata: { igdb: string; developerCountry?: string; originCountry?: string }[] = [];
  wikidataDown = false;

  reply(request: ReceivedRequest) {
    const { endpoint, body } = request;
    if (endpoint.startsWith('sparql')) {
      const bindings = this.wikidata.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, value]) => [k, { type: 'literal', value }]),
        ),
      );
      return { results: { bindings } };
    }
    if (endpoint === 'games' && body.includes('id > ')) {
      const after = Number(/id > (\d+)/.exec(body)![1]);
      const limit = Number(/limit (\d+)/.exec(body)![1]);
      return this.games.filter((g) => g.id > after).slice(0, limit);
    }
    if (endpoint === 'games') {
      return this.games
        .filter((g) => idsIn(body, 'id').includes(g.id))
        .map((g) => ({ id: g.id, genres: (g.genres as { id: number }[]).map((x) => x.id) }));
    }
    if (endpoint === 'companies') {
      return idsIn(body, 'id').flatMap((id) => {
        const company = this.companies.get(id);
        return company ? [{ id, ...company }] : [];
      });
    }
    if (endpoint === 'popularity_primitives') {
      return idsIn(body, 'game_id').flatMap((id) =>
        this.wantToPlay.has(id) ? [{ game_id: id, value: this.wantToPlay.get(id) }] : [],
      );
    }
    return [];
  }
}

describe('Ingestão', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: FakeIgdbServer;
  let catalog: FakeCatalog;
  let ingest: RunIngestionUseCase;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
    await seedReferenceData(prisma);

    server = new FakeIgdbServer();
    const urls = await server.start();
    server.respond = (request) =>
      catalog.wikidataDown && request.endpoint.startsWith('sparql')
        ? { status: 503 }
        : { status: 200, body: catalog.reply(request) };
    const igdb = new IgdbClient({
      credentials: { clientId: 'id', clientSecret: 'secret' },
      ...urls,
      rateLimit: { requestsPerWindow: 1000, windowMs: 1000, maxConcurrent: 8 },
      maxAttempts: 1,
    });
    const ingestion = readIngestionConfig();
    ingest = new RunIngestionUseCase(
      new IgdbCatalogSource(igdb, ingestion),
      new WikidataCountrySource({ endpoint: `${urls.apiUrl}/sparql`, maxAttempts: 1 }),
      new IngestionRepository(prisma),
      { criteria: versioned, tfidf: readTfidfConfig(), ingestion },
    );
  });

  beforeEach(async () => {
    catalog = new FakeCatalog();
    await prisma.$executeRaw`TRUNCATE "IngestionRun", "Game", "Company", "Feature" CASCADE`;
  });

  afterAll(async () => {
    await server.stop();
    await app.close();
  });

  const flagsOf = (runId: string) =>
    prisma.ingestionReviewFlag.findMany({ where: { runId }, orderBy: { igdbId: 'asc' } });
  const gameRow = (igdbId: number) => prisma.game.findUniqueOrThrow({ where: { igdbId } });

  describe('país do estúdio', () => {
    const country = (raw: RawGame) => mapIgdbGame(igdbGameSchema.parse(raw), NOW).studioCountryCode;
    const withoutIgdbCountry = accepted.find((g) => country(g) === null)!;
    const withIgdbCountry = accepted.find((g) => country(g) !== null)!;
    const BRAZIL = 76;

    beforeEach(() => {
      catalog.wikidata = [
        { igdb: withoutIgdbCountry.slug as string, originCountry: String(BRAZIL) },
        { igdb: withIgdbCountry.slug as string, developerCountry: String(BRAZIL) },
      ];
    });

    it('completa pelo Wikidata o país que falta na IGDB, sem trocar o que a IGDB informa', async () => {
      await ingest.execute(NOW);

      expect(await gameRow(withoutIgdbCountry.id)).toMatchObject({
        studioCountryCode: BRAZIL,
        studioCountrySource: 'WIKIDATA',
      });
      expect(await gameRow(withIgdbCountry.id)).toMatchObject({
        studioCountryCode: country(withIgdbCountry),
        studioCountrySource: 'IGDB',
      });
    });

    it('com o Wikidata fora do ar, segue e mantém os países que vieram dele', async () => {
      await ingest.execute(NOW);
      catalog.wikidataDown = true;

      const result = await ingest.execute(NOW);

      expect(result.status).toBe(IngestionStatus.SUCCEEDED);
      expect(result.errorSummary).toContain('países do Wikidata mantidos');
      expect(await gameRow(withoutIgdbCountry.id)).toMatchObject({
        studioCountryCode: BRAZIL,
        studioCountrySource: 'WIKIDATA',
      });
    });
  });

  it('a primeira execução grava o catálogo e sai sem alertas de empresa já revisada', async () => {
    const result = await ingest.execute(NOW);

    expect(result).toMatchObject({
      status: IngestionStatus.SUCCEEDED,
      gamesFetched: fixtureGames.length,
      gamesUpserted: accepted.length,
      gamesInvalid: 0,
      flagsRaised: 0,
      popularityUnit: UNIT,
      popularityMax: 4,
    });
    expect(await flagsOf(result.runId)).toEqual([]);
    expect(await prisma.game.count({ where: { inCatalog: true } })).toBe(accepted.length);
    const run = await prisma.ingestionRun.findUniqueOrThrow({ where: { id: result.runId } });
    expect(run).toMatchObject({ criteriaVersion: versioned.version, popularityUnit: UNIT });
    expect(run.popularityMedian).toBe(medianCount);
    expect(await prisma.gameFeature.count({ where: { tfidfWeight: { gt: 0 } } })).toBeGreaterThan(
      0,
    );
  });

  it('duas execuções seguidas não duplicam registros nem repetem alertas de transição', async () => {
    await ingest.execute(NOW);
    const counts = async () =>
      Promise.all([
        prisma.game.count(),
        prisma.company.count(),
        prisma.feature.count(),
        prisma.gameFeature.count(),
        prisma.gameCompany.count(),
        prisma.gameLanguage.count(),
      ]);
    const first = await counts();

    const second = await ingest.execute(NOW);

    expect(second.status).toBe(IngestionStatus.SUCCEEDED);
    expect(await counts()).toEqual(first);
    expect(await flagsOf(second.runId)).toEqual([]);
  });

  it('reavalia o que já estava gravado: data nova, saída do catálogo e jogo que sumiu', async () => {
    await ingest.execute(NOW);
    const [undated, incomplete, vanished] = accepted.filter(
      (g) => g.first_release_date === undefined,
    );
    const raw = (id: number) => catalog.games.find((g) => g.id === id)!;
    raw(undated!.id).first_release_date = Date.UTC(2027, 2, 1) / 1000;
    raw(incomplete!.id).summary = 'curto';
    catalog.games = catalog.games.filter((g) => g.id !== vanished!.id);
    catalog.companies.set(SCOTTGAMES, { name: 'Scottgames', parent: 990001 });
    catalog.companies.set(990001, { name: 'Grupo nunca avaliado' });

    const result = await ingest.execute(NOW);

    expect(result).toMatchObject({ status: IngestionStatus.SUCCEEDED, gamesDeactivated: 1 });
    const flags = await flagsOf(result.runId);
    expect(flags.map((f) => [f.igdbId, f.kind])).toEqual(
      expect.arrayContaining([
        [undated!.id, ReviewFlagKind.RELEASE_DATE_ASSIGNED],
        [incomplete!.id, ReviewFlagKind.VERDICT_CHANGED],
        [vanished!.id, ReviewFlagKind.LEFT_CANDIDATE_SET],
        [8499, ReviewFlagKind.PARENT_OUTSIDE_MAJORS],
      ]),
    );
    expect(flags.find((f) => f.kind === ReviewFlagKind.LEFT_CANDIDATE_SET)?.detail).toEqual({
      cause: 'NOT_FOUND',
    });
    expect(await gameRow(incomplete!.id)).toMatchObject({
      inCatalog: false,
      criteriaVerdict: { accepted: false, reason: 'INCOMPLETE_ENTRY' },
    });
    expect(await gameRow(vanished!.id)).toMatchObject({ inCatalog: false });
    expect(await gameRow(undated!.id)).toMatchObject({
      inCatalog: true,
      releaseStatus: 'UPCOMING',
    });
  });

  it('a carência pós-lançamento protege só o jogo que já estava no catálogo', async () => {
    const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
    const [kept, newcomer] = accepted.filter((g) => g.first_release_date !== undefined);
    const silent = (game: RawGame) => {
      game.first_release_date = days(10).getTime() / 1000;
      delete game.total_rating_count;
      delete game.hypes;
    };
    const raw = (id: number) => catalog.games.find((g) => g.id === id)!;
    silent(raw(kept!.id));
    const newcomerRaw = raw(newcomer!.id);
    silent(newcomerRaw);
    catalog.games = catalog.games.filter((g) => g.id !== newcomer!.id);

    await ingest.execute(NOW);
    catalog.games = [...catalog.games, newcomerRaw].sort((a, b) => a.id - b.id);
    await ingest.execute(days(30));

    expect(await gameRow(kept!.id)).toMatchObject({ inCatalog: true, releaseStatus: 'RELEASED' });
    expect(await prisma.game.findUnique({ where: { igdbId: newcomer!.id } })).toBeNull();

    const afterGrace = await ingest.execute(days(200));

    expect(await gameRow(kept!.id)).toMatchObject({ inCatalog: false });
    const flag = (await flagsOf(afterGrace.runId)).find(
      (f) => f.igdbId === kept!.id && f.kind === ReviewFlagKind.VERDICT_CHANGED,
    );
    expect(flag?.detail).toMatchObject({ postLaunchGraceEnded: true, criteriaChanged: false });
  });

  it('não desativa nada quando a busca vem muito menor que a anterior', async () => {
    await ingest.execute(NOW);
    catalog.games = catalog.games.slice(5);

    const result = await ingest.execute(NOW);

    expect(result).toMatchObject({ status: IngestionStatus.SUCCEEDED, gamesDeactivated: 0 });
    expect(result.errorSummary).toContain('nenhum foi desativado');
    expect(await prisma.game.count({ where: { inCatalog: false } })).toBe(0);
  });

  it.each<[string, (fake: FakeCatalog) => void, string]>([
    [
      'popularidade fora da grade',
      (fake) => fake.wantToPlay.set(accepted[0]!.id, 2.5 * UNIT),
      'não são múltiplos inteiros',
    ],
    [
      'jogos fora do schema acima do teto',
      (fake) => delete fake.games[0]!.name,
      'falharam no schema',
    ],
  ])('falha sem gravar nada: %s', async (_, breakIt, message) => {
    breakIt(catalog);

    const result = await ingest.execute(NOW);

    expect(result.status).toBe(IngestionStatus.FAILED);
    expect(result.errorSummary).toContain(message);
    expect(await prisma.game.count()).toBe(0);
    const run = await prisma.ingestionRun.findUniqueOrThrow({ where: { id: result.runId } });
    expect(run.status).toBe(IngestionStatus.FAILED);
    expect(run.finishedAt).toBeInstanceOf(Date);
  });

  it('registra a falha da IGDB sem gravar nada', async () => {
    server.replyOnce({ status: 400, body: { message: 'consulta inválida' } });

    const result = await ingest.execute(NOW);

    expect(result.status).toBe(IngestionStatus.FAILED);
    expect(result.errorSummary).toContain('HTTP 400');
    expect(await prisma.game.count()).toBe(0);
  });
});
