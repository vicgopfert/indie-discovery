import { z } from 'zod';
import type { IgdbScopeRecord } from '../review-flags/candidate-set';
import { IGDB_GAME_FIELDS } from './igdb-game.schema';
import { IGDB_MAX_PAGE_SIZE, type IgdbClient, type IgdbRecord } from './igdb.client';
import type { IngestionConfig } from '../ingestion-config';
import type { IgdbCompanyNode } from '../review-flags/review-flags';

// Código conferido na API da IGDB (popularity_types): "Want to Play".
const WANT_TO_PLAY = 2;

const companySchema = z.array(
  z.object({ id: z.number().int(), name: z.string(), parent: z.number().int().optional() }),
);
const popularitySchema = z.array(z.object({ game_id: z.number().int(), value: z.number() }));
const scopeSchema = z.array(
  z.object({ id: z.number().int(), genres: z.array(z.number().int()).default([]) }),
);

export class IgdbCatalogSource {
  constructor(
    private readonly igdb: IgdbClient,
    private readonly config: Pick<IngestionConfig, 'candidateFilter'>,
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
