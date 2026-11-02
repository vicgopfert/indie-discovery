export interface StoredGame {
  igdbId: number;
  name: string;
  inCatalog: boolean;
  firstReleaseDate: Date | null;
  criteriaVersion: string;
  evaluatedAt: Date;
  popularityCount: number;
}
