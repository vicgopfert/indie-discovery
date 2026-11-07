import { z } from 'zod';
import type { IgdbCompanyNode, IgdbScopeRecord } from '../model/igdb-records';
import { IGDB_GAME_FIELDS } from './igdb-game.schema';
import { IGDB_MAX_PAGE_SIZE, type IgdbClient, type IgdbRecord } from './igdb.client';

// Códigos conferidos na API da IGDB: "Want to Play" (popularity_types) e Steam
// (external_game_sources).
const WANT_TO_PLAY = 2;
const STEAM_SOURCE = 1;
// Um jogo pode ter mais de um id da Steam: 200 jogos por consulta cabem no limite de 500 linhas.
const GAMES_PER_EXTERNAL_QUERY = 200;

const companySchema = z.array(
  z.object({ id: z.number().int(), name: z.string(), parent: z.number().int().optional() }),
);
const popularitySchema = z.array(z.object({ game_id: z.number().int(), value: z.number() }));
const externalGamesSchema = z.array(
  z.object({ game: z.number().int().optional(), uid: z.string().optional() }),
);
const scopeSchema = z.array(
  z.object({ id: z.number().int(), genres: z.array(z.number().int()).default([]) }),
);

export class IgdbCatalogSource {
  constructor(
    private readonly igdb: IgdbClient,
    private readonly config: { candidateFilter: string },
  ) {}

  candidates(): AsyncGenerator<IgdbRecord[]> {
    return this.igdb.paginate('games', {
      fields: IGDB_GAME_FIELDS,
      where: this.config.candidateFilter,
    });
  }

  // Sobe as cadeias de empresa-mãe até o topo, uma geração por rodada de consultas.
  async companyGraph(developerIds: Iterable<number>) {
    const graph = new Map<number, IgdbCompanyNode>();
    for (let pending = [...new Set(developerIds)]; pending.length > 0;) {
      const rows = companySchema.parse(
        await this.byIds('companies', 'id,name,parent', 'id', pending),
      );
      for (const { id, name, parent } of rows)
        graph.set(id, { name, parentIgdbId: parent ?? null });
      pending = [
        ...new Set(rows.flatMap(({ parent }) => (parent && !graph.has(parent) ? [parent] : []))),
      ];
    }
    return graph;
  }

  async wantToPlay(gameIds: Iterable<number>) {
    const rows = popularitySchema.parse(
      await this.byIds(
        'popularity_primitives',
        'game_id,value',
        'game_id',
        [...gameIds],
        `popularity_type = ${WANT_TO_PLAY} & `,
      ),
    );
    return new Map(rows.map(({ game_id, value }) => [game_id, value]));
  }

  // Os ids da Steam de cada jogo; o uid que não é número fica de fora.
  async steamAppIds(gameIds: Iterable<number>) {
    const ids = [...gameIds];
    const appids = new Map<number, number[]>();
    for (let start = 0; start < ids.length; start += GAMES_PER_EXTERNAL_QUERY) {
      const batch = ids.slice(start, start + GAMES_PER_EXTERNAL_QUERY);
      const rows = externalGamesSchema.parse(
        await this.igdb.query(
          'external_games',
          `fields game,uid; where game = (${batch.join(',')}) & external_game_source = ${STEAM_SOURCE}; limit ${IGDB_MAX_PAGE_SIZE};`,
        ),
      );
      for (const { game, uid } of rows) {
        if (game === undefined || !uid || !/^\d+$/.test(uid)) continue;
        appids.set(game, [...(appids.get(game) ?? []), Number(uid)]);
      }
    }
    return appids;
  }

  // Busca de novo, pelo id, jogos que a passada pelo conjunto candidato não guardou.
  games(gameIds: Iterable<number>) {
    return this.byIds('games', IGDB_GAME_FIELDS, 'id', [...gameIds]);
  }

  async scope(gameIds: Iterable<number>) {
    const rows = scopeSchema.parse(await this.byIds('games', 'id,genres', 'id', [...gameIds]));
    return new Map<number, IgdbScopeRecord>(rows.map(({ id, genres }) => [id, { genres }]));
  }

  private async byIds(
    endpoint: string,
    fields: string,
    idField: string,
    ids: number[],
    filter = '',
  ) {
    const rows: unknown[] = [];
    for (let start = 0; start < ids.length; start += IGDB_MAX_PAGE_SIZE) {
      const batch = ids.slice(start, start + IGDB_MAX_PAGE_SIZE);
      const page = await this.igdb.query(
        endpoint,
        `fields ${fields}; where ${filter}${idField} = (${batch.join(',')}); limit ${IGDB_MAX_PAGE_SIZE};`,
      );
      rows.push(...(page as unknown[]));
    }
    return rows;
  }
}
