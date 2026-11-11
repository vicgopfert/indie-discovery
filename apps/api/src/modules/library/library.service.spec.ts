import { LIST_TYPES } from '@indie/contracts';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import type { FeatureType, ListType } from '../../generated/prisma/client';
import type { CatalogRepository, FeatureCountRow } from '../catalog/catalog.repository';
import { CatalogService } from '../catalog/catalog.service';
import { FeatureLabels, featureLabelsConfigSchema } from '../catalog/feature-labels';
import type { LibraryGameRow, LibraryRepository, PreferenceRow } from './library.repository';
import { LibraryService } from './library.service';

const labels = new FeatureLabels(
  featureLabelsConfigSchema.parse({
    labelsRationale: 'motivo',
    labels: {
      GENRE: { puzzle: 'Quebra-cabeça', platform: 'Plataforma', indie: 'Indie' },
      THEME: { horror: 'Terror' },
    },
    hiddenFromFilters: { GENRE: ['indie'], THEME: [] },
    hiddenRationale: 'motivo',
  }),
);

const options: Record<'GENRE' | 'THEME' | 'TAG', FeatureCountRow[]> = {
  GENRE: [
    { slug: 'puzzle', name: 'Puzzle', gameCount: 10 },
    { slug: 'platform', name: 'Platform', gameCount: 8 },
    { slug: 'indie', name: 'Indie', gameCount: 20 },
  ],
  THEME: [{ slug: 'horror', name: 'Horror', gameCount: 5 }],
  TAG: [
    { slug: 'roguelike', name: 'Roguelike', gameCount: 6 },
    { slug: 'platformer', name: 'Plataforma', gameCount: 7 },
    { slug: 'psychological-horror', name: 'Terror Psicológico', gameCount: 3 },
    { slug: 'pixel-graphics', name: 'Pixel Art', gameCount: 9 },
    { slug: 'visual-novel', name: 'Romance Visual', gameCount: 2 },
  ],
};

// Pixel Art não vira prateleira; Plataforma diz o mesmo que um gênero oferecido; Romance Visual
// aponta para um gênero que não está nas opções.
const PREFERENCE_TAGS = new Map<string, string | null>([
  ['roguelike', null],
  ['platformer', 'genre:platform'],
  ['psychological-horror', null],
  ['visual-novel', 'genre:visual-novel'],
]);

const game = (slug: string, inCatalog = true): LibraryGameRow & { id: string } => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  coverImageId: `cover-${slug}`,
  releaseStatus: 'RELEASED',
  firstReleaseDate: null,
  features: [],
  inCatalog,
});

const GAMES = [game('celeste'), game('fora-do-catalogo', false)];

class FakeLibrary implements Pick<
  LibraryRepository,
  | 'findGame'
  | 'upsertRating'
  | 'deleteRating'
  | 'addToList'
  | 'removeFromList'
  | 'findLibrary'
  | 'findGameState'
  | 'findFeatureIds'
  | 'replacePreferences'
  | 'findPreferences'
  | 'hasPreferences'
  | 'findOnboardingGames'
> {
  ratings = new Map<string, number>();
  lists = new Set<string>();
  preferences: string[] = [];
  onboardedAt: Date | null = null;
  onboardingLimit: number | null = null;

  findGame(slug: string) {
    const found = GAMES.find((candidate) => candidate.slug === slug);
    return Promise.resolve(found ? { id: found.id, inCatalog: found.inCatalog } : null);
  }

  upsertRating(_userId: string, gameId: string, score: number) {
    this.ratings.set(gameId, score);
    return Promise.resolve({ score, updatedAt: new Date('2026-11-02T12:00:00Z') });
  }

  deleteRating(_userId: string, gameId: string) {
    this.ratings.delete(gameId);
    return Promise.resolve();
  }

  addToList(_userId: string, gameId: string, listType: ListType, exclusive: ListType[]) {
    for (const other of exclusive) this.lists.delete(`${gameId}:${other}`);
    this.lists.add(`${gameId}:${listType}`);
    return Promise.resolve(
      [...this.lists]
        .filter((key) => key.startsWith(`${gameId}:`))
        .map((key) => key.split(':')[1] as ListType)
        .sort((a, b) => LIST_TYPES.indexOf(a) - LIST_TYPES.indexOf(b)),
    );
  }

  removeFromList(_userId: string, gameId: string, listType: ListType) {
    this.lists.delete(`${gameId}:${listType}`);
    return Promise.resolve();
  }

  findLibrary() {
    const [celeste, gone] = GAMES;
    return Promise.resolve({
      ratings: [{ score: 4, updatedAt: new Date('2026-11-02T12:00:00Z'), game: gone! }],
      listEntries: [
        {
          listType: 'FAVORITE' as const,
          createdAt: new Date('2026-11-02T13:00:00Z'),
          game: celeste!,
        },
        {
          listType: 'COMPLETED' as const,
          createdAt: new Date('2026-11-01T13:00:00Z'),
          game: gone!,
        },
      ],
    });
  }

  findGameState(_userId: string, gameId: string) {
    const score = this.ratings.get(gameId);
    return Promise.resolve({
      rating: score === undefined ? null : { score, updatedAt: new Date('2026-11-02T12:00:00Z') },
      lists: [...this.lists]
        .filter((key) => key.startsWith(`${gameId}:`))
        .map((key) => key.split(':')[1] as ListType),
    });
  }

  findFeatureIds(type: FeatureType, slugs: string[]) {
    return Promise.resolve(slugs.map((slug) => `${type}:${slug}`));
  }

  replacePreferences(_userId: string, featureIds: string[], now: Date) {
    this.preferences = featureIds;
    this.onboardedAt ??= now;
    return Promise.resolve();
  }

  hasPreferences() {
    return Promise.resolve(this.preferences.length > 0);
  }

  findOnboardingGames(_userId: string, limit: number) {
    this.onboardingLimit = limit;
    return Promise.resolve([game('celeste')]);
  }

  findPreferences(): Promise<PreferenceRow[]> {
    return Promise.resolve(
      this.preferences.map((id) => {
        const [type, slug] = id.split(':') as ['GENRE' | 'THEME' | 'TAG', string];
        return { type, slug, name: options[type].find((option) => option.slug === slug)!.name };
      }),
    );
  }
}

describe('LibraryService', () => {
  let library: FakeLibrary;
  let service: LibraryService;

  beforeEach(() => {
    library = new FakeLibrary();
    const catalog = {
      countGamesByFeature: (type: 'GENRE' | 'THEME' | 'TAG') => Promise.resolve(options[type]),
    } as unknown as CatalogRepository;
    service = new LibraryService(
      library as unknown as LibraryRepository,
      new CatalogService(catalog, labels, 20, new Map()),
      PREFERENCE_TAGS,
    );
  });

  describe('avaliação', () => {
    it('grava a nota do jogo do catálogo', async () => {
      expect(await service.rate('u1', 'celeste', 4)).toEqual({
        score: 4,
        updatedAt: '2026-11-02T12:00:00.000Z',
      });
      expect(library.ratings.get('id-celeste')).toBe(4);
    });

    it('não avalia jogo inexistente nem fora do catálogo', async () => {
      for (const slug of ['nao-existe', 'fora-do-catalogo']) {
        await expect(service.rate('u1', slug, 4)).rejects.toThrow(
          new NotFoundException('Jogo não encontrado.'),
        );
      }
    });

    it('remove a avaliação mesmo do jogo fora do catálogo', async () => {
      library.ratings.set('id-fora-do-catalogo', 3);

      await service.unrate('u1', 'fora-do-catalogo');

      expect(library.ratings.size).toBe(0);
      await expect(service.unrate('u1', 'nao-existe')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listas', () => {
    it('"concluídos" tira de "quero jogar" e vice-versa, sem mexer em "favoritos"', async () => {
      await service.addToList('u1', 'celeste', 'FAVORITE');
      await service.addToList('u1', 'celeste', 'WANT_TO_PLAY');

      expect(await service.addToList('u1', 'celeste', 'COMPLETED')).toEqual({
        lists: ['FAVORITE', 'COMPLETED'],
      });
      expect(await service.addToList('u1', 'celeste', 'WANT_TO_PLAY')).toEqual({
        lists: ['FAVORITE', 'WANT_TO_PLAY'],
      });
    });

    it('não põe em lista o jogo fora do catálogo, mas tira', async () => {
      library.lists.add('id-fora-do-catalogo:FAVORITE');

      await expect(service.addToList('u1', 'fora-do-catalogo', 'COMPLETED')).rejects.toThrow(
        NotFoundException,
      );
      await service.removeFromList('u1', 'fora-do-catalogo', 'FAVORITE');

      expect(library.lists.size).toBe(0);
    });
  });

  describe('estado de um jogo', () => {
    it('traz a nota e as listas, ou nota nula e nenhuma lista', async () => {
      expect(await service.findGameState('u1', 'celeste')).toEqual({ rating: null, lists: [] });

      await service.rate('u1', 'celeste', 4);
      await service.addToList('u1', 'celeste', 'FAVORITE');

      expect(await service.findGameState('u1', 'celeste')).toEqual({
        rating: { score: 4, updatedAt: '2026-11-02T12:00:00.000Z' },
        lists: ['FAVORITE'],
      });
    });

    it('vale para o jogo fora do catálogo, mas não para o inexistente', async () => {
      library.ratings.set('id-fora-do-catalogo', 3);

      expect(await service.findGameState('u1', 'fora-do-catalogo')).toMatchObject({
        rating: { score: 3 },
      });
      await expect(service.findGameState('u1', 'nao-existe')).rejects.toThrow(
        new NotFoundException('Jogo não encontrado.'),
      );
    });
  });

  it('a biblioteca separa as listas e marca o jogo fora do catálogo', async () => {
    const result = await service.findLibrary('u1');

    expect(result.ratings).toMatchObject([{ score: 4, game: { inCatalog: false } }]);
    expect(result.lists).toMatchObject({
      FAVORITE: [
        { game: { slug: 'celeste', inCatalog: true }, addedAt: '2026-11-02T13:00:00.000Z' },
      ],
      COMPLETED: [{ game: { slug: 'fora-do-catalogo', inCatalog: false } }],
      WANT_TO_PLAY: [],
    });
  });

  describe('preferências', () => {
    it('oferece as etiquetas que viram prateleira, sem repetir a ideia de um gênero ou tema', async () => {
      const { genres, themes, tags } = await service.findPreferenceOptions();

      expect(genres.map(({ slug }) => slug)).toEqual(['platform', 'puzzle']);
      expect(themes.map(({ slug }) => slug)).toEqual(['horror']);
      expect(tags.map(({ slug }) => slug)).toEqual([
        'roguelike',
        'visual-novel',
        'psychological-horror',
      ]);
    });

    it('grava gêneros, temas e etiquetas e devolve os nomes em português', async () => {
      expect(
        await service.savePreferences('u1', {
          genres: ['puzzle', 'platform'],
          themes: ['horror'],
          tags: ['roguelike', 'psychological-horror'],
        }),
      ).toEqual({
        genres: [
          { slug: 'platform', name: 'Plataforma' },
          { slug: 'puzzle', name: 'Quebra-cabeça' },
        ],
        themes: [{ slug: 'horror', name: 'Terror' }],
        tags: [
          { slug: 'roguelike', name: 'Roguelike' },
          { slug: 'psychological-horror', name: 'Terror Psicológico' },
        ],
      });
    });

    it('recusa o que as opções não oferecem: gênero escondido e etiqueta repetida ou sem prateleira', async () => {
      const save = service.savePreferences('u1', {
        genres: ['puzzle', 'indie', 'roguelike'],
        themes: ['horror', 'space'],
        tags: ['roguelike', 'platformer', 'pixel-graphics'],
      });

      await expect(save).rejects.toThrow(BadRequestException);
      await expect(save).rejects.toMatchObject({
        response: {
          message: [
            'genres: Opção desconhecida: indie, roguelike.',
            'themes: Opção desconhecida: space.',
            'tags: Opção desconhecida: platformer, pixel-graphics.',
          ],
        },
      });
      expect(library.preferences).toEqual([]);
    });

    it('conclui a partida a frio só na primeira vez', async () => {
      await service.savePreferences('u1', {
        genres: ['puzzle', 'platform'],
        themes: ['horror'],
        tags: [],
      });
      const first = library.onboardedAt;
      await service.savePreferences('u1', { genres: ['puzzle'], themes: ['horror'], tags: [] });

      expect(first).toBeInstanceOf(Date);
      expect(library.onboardedAt).toBe(first);
      expect(library.preferences).toEqual(['GENRE:puzzle', 'THEME:horror']);
    });
  });

  describe('jogos da partida a frio', () => {
    it('sem preferências gravadas, recusa com 409', async () => {
      await expect(service.findOnboardingGames('u1')).rejects.toThrow(ConflictException);
      expect(library.onboardingLimit).toBeNull();
    });

    it('pede até 60 jogos e devolve o resumo do catálogo', async () => {
      library.preferences = ['GENRE:puzzle'];

      expect(await service.findOnboardingGames('u1')).toEqual({
        items: [
          {
            slug: 'celeste',
            name: 'celeste',
            coverImageId: 'cover-celeste',
            releaseStatus: 'RELEASED',
            firstReleaseDate: null,
            genres: [],
          },
        ],
      });
      expect(library.onboardingLimit).toBe(60);
    });
  });
});
