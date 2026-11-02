import { ReviewFlagKind } from '../../../generated/prisma/client';
import type { ReviewFlag } from '../model/review-flag';
import type { CollectionsConfig } from './collections.config';

const published = (collections: CollectionsConfig['collections']) =>
  collections.filter((c) => c.published);

export interface CollectionWrite {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  gameIgdbIds: number[];
}

// O vínculo é gravado mesmo para o jogo fora do catálogo, para ele não perder a coleção se voltar;
// as consultas da API filtram o catálogo.
export function collectionWrites({ collections }: CollectionsConfig): CollectionWrite[] {
  return published(collections).map((c, sortOrder) => ({
    slug: c.slug,
    name: c.name,
    description: c.description,
    sortOrder,
    gameIgdbIds: c.games.map((g) => g.igdbId),
  }));
}

// Um jogo aprovado fora do catálogo pede revisão: a coleção pode ficar abaixo do mínimo na
// interface sem que o arquivo mude.
export function collectionFlags(
  { collections, minGames }: CollectionsConfig,
  catalogIgdbIds: ReadonlySet<number>,
): ReviewFlag[] {
  return published(collections).flatMap((c) => {
    const missing = c.games.filter((g) => !catalogIgdbIds.has(g.igdbId));
    const catalogGames = c.games.length - missing.length;
    return missing.map((g) => ({
      kind: ReviewFlagKind.COLLECTION_GAME_OUT_OF_CATALOG,
      igdbId: g.igdbId,
      gameName: g.name,
      detail: { collection: c.slug, catalogGames, minGames },
    }));
  });
}
