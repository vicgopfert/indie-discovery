import { CollectionPageQuerySchema } from '@indie/contracts';

export const COLLECTIONS_PATH = '/colecoes';

export const collectionHref = (slug: string, page = 1) =>
  `${COLLECTIONS_PATH}/${encodeURIComponent(slug)}${page > 1 ? `?page=${page}` : ''}`;

// Uma página inválida na URL (?page=abc, 0, repetida) mostra a primeira, sem tela de erro.
export function parseCollectionPage(value: string | string[] | undefined): number {
  const parsed = CollectionPageQuerySchema.safeParse({ page: value });
  return parsed.success ? parsed.data.page : 1;
}

export const gameCountLabel = (count: number) =>
  count === 1 ? '1 jogo' : `${count.toLocaleString('pt-BR')} jogos`;
