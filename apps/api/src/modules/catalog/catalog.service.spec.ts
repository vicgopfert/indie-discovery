import { GameSearchQuerySchema } from '@indie/contracts';
import { NotFoundException } from '@nestjs/common';
import type {
  CatalogRepository,
  CountryCountRow,
  FeatureCountRow,
  GameDetailRow,
  GameSummaryRow,
} from './catalog.repository';
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

const feature = (type: 'GENRE' | 'THEME', slug: string, name: string) => ({
  feature: { type, slug, name },
});

const company = (name: string, isDeveloper: boolean, isPublisher: boolean) => ({
  isDeveloper,
  isPublisher,
  company: { name },
});

const language = (locale: string, namePt: string, support: Partial<Record<string, boolean>>) => ({
  interface: false,
  subtitles: false,
  audio: false,
  ...support,
  language: { locale, namePt },
});

const celesteDetail: GameDetailRow = {
  slug: 'celeste',
  name: 'Celeste',
  coverImageId: 'co3byy',
  releaseStatus: 'RELEASED',
  firstReleaseDate: new Date('2018-01-25T00:00:00Z'),
  summary: 'Ajude Madeline a escalar a montanha.',
  storeUrl: 'https://www.celestegame.com',
  studioCountrySource: 'WIKIDATA',
  studioCountry: { alpha2: 'CA', namePt: 'Canadá' },
  features: [
    feature('GENRE', 'puzzle', 'Puzzle'),
    feature('GENRE', 'indie', 'Indie'),
    feature('THEME', 'horror', 'Horror'),
    feature('GENRE', 'adventure', 'Adventure'),
  ],
  companies: [
    company('Maddy Makes Games', true, true),
    company('Extremely OK Games', true, false),
    company('Annapurna', false, true),
  ],
  languages: [
    language('pt-BR', 'Português (Brasil)', { interface: true, subtitles: true }),
    language('en-US', 'Inglês', { interface: true, subtitles: true, audio: true }),
  ],
};

class FakeCatalog implements Pick<
  CatalogRepository,
  'searchGames' | 'countGamesByFeature' | 'findGameBySlug' | 'countGamesByCountry'
> {
  constructor(
    private readonly games: { total: number; games: GameSummaryRow[] },
    private readonly features: FeatureCountRow[] = [],
    private readonly detail: GameDetailRow | null = null,
    private readonly countries: CountryCountRow[] = [],
  ) {}

  countGamesByCountry() {
    return Promise.resolve(this.countries);
  }

  findGameBySlug() {
    return Promise.resolve(this.detail);
  }

  searchGames() {
    return Promise.resolve(this.games);
  }

  countGamesByFeature() {
    return Promise.resolve(this.features);
  }
}

const service = (catalog: FakeCatalog) =>
  new CatalogService(catalog as unknown as CatalogRepository, labels, 20);

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

  describe('findGame', () => {
    const findGame = (detail: GameDetailRow | null) =>
      service(new FakeCatalog({ total: 0, games: [] }, [], detail)).findGame('celeste');

    it('monta a ficha com atributos em português, empresas por papel, país e idiomas', async () => {
      expect(await findGame(celesteDetail)).toEqual({
        slug: 'celeste',
        name: 'Celeste',
        coverImageId: 'co3byy',
        releaseStatus: 'RELEASED',
        firstReleaseDate: '2018-01-25',
        genres: [
          { slug: 'adventure', name: 'Aventura' },
          { slug: 'puzzle', name: 'Quebra-cabeça' },
        ],
        summary: 'Ajude Madeline a escalar a montanha.',
        themes: [{ slug: 'horror', name: 'Terror' }],
        developers: ['Extremely OK Games', 'Maddy Makes Games'],
        publishers: ['Annapurna', 'Maddy Makes Games'],
        studioCountry: { code: 'CA', name: 'Canadá', source: 'WIKIDATA' },
        languages: [
          { locale: 'en-US', name: 'Inglês', interface: true, subtitles: true, audio: true },
          {
            locale: 'pt-BR',
            name: 'Português (Brasil)',
            interface: true,
            subtitles: true,
            audio: false,
          },
        ],
        officialUrl: 'https://www.celestegame.com',
      });
    });

    it('sem país, empresas, idiomas e link, devolve vazio e nulo', async () => {
      const detail = await findGame({
        ...celesteDetail,
        studioCountry: null,
        studioCountrySource: null,
        companies: [],
        languages: [],
        storeUrl: null,
      });

      expect(detail).toMatchObject({
        developers: [],
        publishers: [],
        studioCountry: null,
        languages: [],
        officialUrl: null,
      });
    });

    it.each(['javascript:alert(1)', 'ftp://celeste.example', 'não é link'])(
      'descarta link que não é endereço web: %s',
      async (storeUrl) => {
        expect((await findGame({ ...celesteDetail, storeUrl })).officialUrl).toBeNull();
      },
    );

    it('jogo inexistente ou fora do catálogo responde 404', async () => {
      await expect(findGame(null)).rejects.toThrow(new NotFoundException('Jogo não encontrado.'));
    });
  });

  describe('listCountries', () => {
    it('só lista países com pelo menos 20 jogos, pelo nome em português', async () => {
      const catalog = new FakeCatalog({ total: 0, games: [] }, [], null, [
        { alpha2: 'US', namePt: 'Estados Unidos', gameCount: 2042 },
        { alpha2: 'MY', namePt: 'Malásia', gameCount: 21 },
        { alpha2: 'PH', namePt: 'Filipinas', gameCount: 20 },
        { alpha2: 'UY', namePt: 'Uruguai', gameCount: 19 },
        { alpha2: 'BR', namePt: 'Brasil', gameCount: 251 },
      ]);

      expect(await service(catalog).listCountries()).toEqual([
        { code: 'BR', name: 'Brasil', gameCount: 251 },
        { code: 'US', name: 'Estados Unidos', gameCount: 2042 },
        { code: 'PH', name: 'Filipinas', gameCount: 20 },
        { code: 'MY', name: 'Malásia', gameCount: 21 },
      ]);
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
