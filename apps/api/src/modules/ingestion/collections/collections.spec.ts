import { ReviewFlagKind } from '../../../generated/prisma/client';
import { collectionFlags, collectionWrites } from './collections';
import type { CollectionsConfig, CuratedCollection } from './collections.config';

const collection = (slug: string, igdbIds: number[], published = true): CuratedCollection => ({
  slug,
  name: `Coleção ${slug}`,
  description: `Descrição de ${slug}`,
  scope: 'Escopo',
  published,
  suggest: { keywords: [], summaryTerms: [], wikidataPlaces: [] },
  games: igdbIds.map((igdbId) => ({ igdbId, name: `Jogo ${igdbId}` })),
  rejected: [],
});

const config = (collections: CuratedCollection[]): CollectionsConfig => ({
  curationPolicy: 'Política',
  minGames: 2,
  minGamesRationale: 'Motivo',
  collections,
});

describe('coleções na ingestão', () => {
  it('grava as coleções na ordem do arquivo, com os jogos aprovados', () => {
    expect(collectionWrites(config([collection('b', [1, 2]), collection('a', [3])]))).toEqual([
      {
        slug: 'b',
        name: 'Coleção b',
        description: 'Descrição de b',
        sortOrder: 0,
        gameIgdbIds: [1, 2],
      },
      {
        slug: 'a',
        name: 'Coleção a',
        description: 'Descrição de a',
        sortOrder: 1,
        gameIgdbIds: [3],
      },
    ]);
  });

  it('avisa de cada jogo aprovado fora do catálogo, com quantos a coleção ainda tem', () => {
    const flags = collectionFlags(
      config([collection('brasil', [1, 2, 3]), collection('japao', [4])]),
      new Set([1, 4]),
    );

    expect(flags).toEqual([
      {
        kind: ReviewFlagKind.COLLECTION_GAME_OUT_OF_CATALOG,
        igdbId: 2,
        gameName: 'Jogo 2',
        detail: { collection: 'brasil', catalogGames: 1, minGames: 2 },
      },
      {
        kind: ReviewFlagKind.COLLECTION_GAME_OUT_OF_CATALOG,
        igdbId: 3,
        gameName: 'Jogo 3',
        detail: { collection: 'brasil', catalogGames: 1, minGames: 2 },
      },
    ]);
  });

  it('deixa o rascunho fora do banco e dos alertas, sem contar na ordem', () => {
    const drafted = config([collection('rascunho', [1], false), collection('brasil', [2])]);

    expect(collectionWrites(drafted).map((c) => [c.slug, c.sortOrder])).toEqual([['brasil', 0]]);
    expect(collectionFlags(drafted, new Set())).toMatchObject([{ igdbId: 2 }]);
  });

  it('não avisa quando todos os jogos estão no catálogo', () => {
    expect(collectionFlags(config([collection('brasil', [1, 2])]), new Set([1, 2]))).toEqual([]);
  });
});
