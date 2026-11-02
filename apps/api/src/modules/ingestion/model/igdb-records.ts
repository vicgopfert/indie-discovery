// Formas mínimas dos registros da IGDB que a avaliação usa, sem depender do cliente da IGDB.
export interface IgdbScopeRecord {
  genres: number[];
}

export interface IgdbCompanyNode {
  name: string;
  parentIgdbId: number | null;
}
