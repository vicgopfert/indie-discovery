import { LIST_TYPES } from '@indie/contracts';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

const options: Record<'GENRE' | 'THEME', FeatureCountRow[]> = {
  GENRE: [
    { slug: 'puzzle', name: 'Puzzle', gameCount: 10 },
    { slug: 'platform', name: 'Platform', gameCount: 8 },
    { slug: 'indie', name: 'Indie', gameCount: 20 },
  ],
  THEME: [{ slug: 'horror', name: 'Horror', gameCount: 5 }],
};

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
  | 'findFeatureIds'
  | 'replacePreferences'
  | 'findPreferences'
> {
  ratings = new Map<string, number>();
  lists = new Set<string>();
  preferences: string[] = [];
  onboardedAt: Date | null = null;

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

  findFeatureIds(type: FeatureType, slugs: string[]) {
    return Promise.resolve(slugs.map((slug) => `${type}:${slug}`));
  }

  replacePreferences(_userId: string, featureIds: string[], now: Date) {
    this.preferences = featureIds;
    this.onboardedAt ??= now;
    return Promise.resolve();
  }

  findPreferences(): Promise<PreferenceRow[]> {
    return Promise.resolve(
      this.preferences.map((id) => {
        const [type, slug] = id.split(':') as ['GENRE' | 'THEME', string];
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
      countGamesByFeature: (type: 'GENRE' | 'THEME') => Promise.resolve(options[type]),
    } as unknown as CatalogRepository;
    service = new LibraryService(
      library as unknown as LibraryRepository,
      new CatalogService(catalog, labels, 20),
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
    it('grava gêneros e temas e devolve os nomes em português', async () => {
      expect(
        await service.savePreferences('u1', { genres: ['puzzle', 'platform'], themes: ['horror'] }),
      ).toEqual({
        genres: [
          { slug: 'platform', name: 'Plataforma' },
          { slug: 'puzzle', name: 'Quebra-cabeça' },
        ],
        themes: [{ slug: 'horror', name: 'Terror' }],
      });
    });

    it('recusa o que GET /features não oferece, incluindo o gênero escondido', async () => {
      const save = service.savePreferences('u1', {
        genres: ['puzzle', 'indie', 'roguelike'],
        themes: ['horror', 'space'],
      });

      await expect(save).rejects.toThrow(BadRequestException);
      await expect(save).rejects.toMatchObject({
        response: {
          message: [
            'genres: Opção desconhecida: indie, roguelike.',
            'themes: Opção desconhecida: space.',
          ],
        },
      });
      expect(library.preferences).toEqual([]);
    });

    it('conclui a partida a frio só na primeira vez', async () => {
      await service.savePreferences('u1', { genres: ['puzzle', 'platform'], themes: ['horror'] });
      const first = library.onboardedAt;
      await service.savePreferences('u1', { genres: ['puzzle'], themes: ['horror'] });

      expect(first).toBeInstanceOf(Date);
      expect(library.onboardedAt).toBe(first);
      expect(library.preferences).toEqual(['GENRE:puzzle', 'THEME:horror']);
    });
  });
});
