import { GameSearchQuerySchema } from '@indie/contracts';
import type { CatalogRepository, FeatureCountRow, GameSummaryRow } from './catalog.repository';
import { CatalogService } from './catalog.service';
import { FeatureLabels, featureLabelsConfigSchema } from './feature-labels';

const labels = new FeatureLabels(
  featureLabelsConfigSchema.parse({
    labelsRationale: 'motivo',
    labels: {
      GENRE: { adventure: 'Aventura', puzzle: 'Quebra-cabeça', indie: 'Indie' },
      THEME: { horror: 'Terror' },
    },
    hiddenFromFilters: { GENRE: ['indie'], THEME: [] },
    hiddenRationale: 'motivo',
  }),
);

const genre = (slug: string, name: string) => ({ feature: { slug, name } });

const celeste: GameSummaryRow = {
  slug: 'celeste',
  name: 'Celeste',
  coverImageId: 'co3byy',
  releaseStatus: 'RELEASED',
  firstReleaseDate: new Date('2018-01-25T00:00:00Z'),
  features: [genre('puzzle', 'Puzzle'), genre('indie', 'Indie'), genre('adventure', 'Adventure')],
};

class FakeCatalog implements Pick<CatalogRepository, 'searchGames' | 'countGamesByFeature'> {
  constructor(
    private readonly games: { total: number; games: GameSummaryRow[] },
    private readonly features: FeatureCountRow[] = [],
  ) {}

  searchGames() {
    return Promise.resolve(this.games);
  }

  countGamesByFeature() {
    return Promise.resolve(this.features);
  }
}

const service = (catalog: FakeCatalog) =>
  new CatalogService(catalog as unknown as CatalogRepository, labels);

describe('CatalogService', () => {
  describe('searchGames', () => {
    it('monta a página com o total de páginas', async () => {
      const query = GameSearchQuerySchema.parse({ page: '2', pageSize: '10' });

      const page = await service(new FakeCatalog({ total: 21, games: [] })).searchGames(query);

      expect(page).toEqual({ items: [], page: 2, pageSize: 10, total: 21, totalPages: 3 });
    });

    it('sem resultados, tem zero páginas', async () => {
      const query = GameSearchQuerySchema.parse({});

      const page = await service(new FakeCatalog({ total: 0, games: [] })).searchGames(query);

      expect(page.totalPages).toBe(0);
    });

    it('traduz os gêneros, tira o Indie e ordena pelo nome em português', async () => {
      const query = GameSearchQuerySchema.parse({});

      const page = await service(new FakeCatalog({ total: 1, games: [celeste] })).searchGames(
        query,
      );

      expect(page.items).toEqual([
        {
          slug: 'celeste',
          name: 'Celeste',
          coverImageId: 'co3byy',
          releaseStatus: 'RELEASED',
          firstReleaseDate: '2018-01-25',
          genres: [
            { slug: 'adventure', name: 'Aventura' },
            { slug: 'puzzle', name: 'Quebra-cabeça' },
          ],
        },
      ]);
    });

    it('jogo sem data de lançamento sai com data nula', async () => {
      const query = GameSearchQuerySchema.parse({});
      const undated = { ...celeste, firstReleaseDate: null };

      const page = await service(new FakeCatalog({ total: 1, games: [undated] })).searchGames(
        query,
      );

      expect(page.items[0]?.firstReleaseDate).toBeNull();
    });
  });

  describe('listFeatures', () => {
    it('traduz, esconde o Indie e ordena pelo nome em português', async () => {
      const catalog = new FakeCatalog({ total: 0, games: [] }, [
        { slug: 'puzzle', name: 'Puzzle', gameCount: 3 },
        { slug: 'indie', name: 'Indie', gameCount: 10 },
        { slug: 'adventure', name: 'Adventure', gameCount: 5 },
        { slug: 'new-genre', name: 'New Genre', gameCount: 1 },
      ]);

      const options = await service(catalog).listFeatures({ type: 'genre' });

      expect(options).toEqual([
        { slug: 'adventure', name: 'Aventura', gameCount: 5 },
        { slug: 'new-genre', name: 'New Genre', gameCount: 1 },
        { slug: 'puzzle', name: 'Quebra-cabeça', gameCount: 3 },
      ]);
    });
  });
});
