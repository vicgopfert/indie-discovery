// Jogo gravado que não voltou no conjunto candidato. A desativação só acontece quando a busca
// trouxe quase tudo o que a última execução bem-sucedida trouxe: uma resposta parcial da IGDB não
// pode tirar jogos do catálogo.
export type MissingCause = 'LOST_INDIE_GENRE' | 'OUT_OF_SCOPE' | 'NOT_FOUND';

export interface IgdbScopeRecord {
  genres: number[];
}

export function canDeactivateMissing(
  fetched: number,
  previousFetched: number | null,
  minFetchedRatio: number,
) {
  return previousFetched === null || fetched >= previousFetched * minFetchedRatio;
}

export function missingCause(
  record: IgdbScopeRecord | undefined,
  indieGenreId: number,
): MissingCause {
  if (record === undefined) return 'NOT_FOUND';
  return record.genres.includes(indieGenreId) ? 'OUT_OF_SCOPE' : 'LOST_INDIE_GENRE';
}
