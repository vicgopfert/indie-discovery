import { FeatureType, ListType, ReleaseStatus } from '../../src/generated/prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { CatalogBuilder, type GameSpec } from './catalog-builder';

// Um catálogo que gera a página completa com a configuração real: a principal, as duas
// prateleiras "Porque você gostou de", três de interesse e "Em breve". Com 110 jogos, cada
// família de etiqueta (10 jogos) fica abaixo dos 10% das prateleiras específicas. Dentro de cada
// família os vetores são iguais e as popularidades diferentes: os modos mudam a ordem.
const families: { prefix: string; count: number; spec: Omit<GameSpec, 'name'> }[] = [
  { prefix: 'Roguelike', count: 8, spec: { genres: ['Shooter'], tags: ['Roguelike'] } },
  {
    prefix: 'Metroidvania',
    count: 8,
    spec: { genres: ['Platform'], themes: ['Fantasy'], tags: ['Metroidvania'] },
  },
  { prefix: 'Fazenda', count: 6, spec: { genres: ['Simulator'], tags: ['Farming Sim', 'Cozy'] } },
  {
    prefix: 'Detetive',
    count: 6,
    spec: { genres: ['Adventure'], themes: ['Mystery'], tags: ['Detective'] },
  },
  { prefix: 'Quebra-cabeca', count: 12, spec: { genres: ['Puzzle'] } },
  {
    prefix: 'Em breve',
    count: 6,
    spec: { genres: ['Platform'], themes: ['Fantasy'], status: ReleaseStatus.UPCOMING },
  },
  { prefix: 'Enchimento', count: 55, spec: { genres: ['Racing'] } },
];

const library: (GameSpec & { score?: number; lists?: ListType[] })[] = [
  { name: 'Origem Roguelike A', genres: ['Shooter'], tags: ['Roguelike'], score: 5 },
  { name: 'Origem Roguelike B', genres: ['Shooter'], tags: ['Roguelike'], score: 5 },
  {
    name: 'Origem Metroidvania A',
    genres: ['Platform'],
    themes: ['Fantasy'],
    tags: ['Metroidvania'],
    score: 5,
  },
  {
    name: 'Origem Metroidvania B',
    genres: ['Platform'],
    themes: ['Fantasy'],
    tags: ['Metroidvania'],
    score: 4,
  },
  // Nenhuma prateleira de interesse cobre estes dois: viram "Porque você gostou de".
  {
    name: 'Origem Fazenda',
    genres: ['Simulator'],
    tags: ['Farming Sim', 'Cozy'],
    score: 4,
    lists: [ListType.FAVORITE],
  },
  {
    name: 'Origem Detetive',
    genres: ['Adventure'],
    themes: ['Mystery'],
    tags: ['Detective'],
    score: 5,
  },
  { name: 'Origem Terror', genres: ['Fighting'], themes: ['Horror'], score: 1 },
  { name: 'Origem Quero Jogar', genres: ['Sport'], lists: [ListType.WANT_TO_PLAY] },
];

export const LIKED_GAME_KEYS = ['game:origem-fazenda', 'game:origem-detetive'];
export const INTEREST_KEYS = ['tag:roguelike', 'tag:metroidvania', 'genre:puzzle'];

export async function seedRecommendationCatalog(prisma: PrismaService) {
  await prisma.$executeRaw`TRUNCATE "User", "Game", "Feature", "Company" CASCADE`;
  const catalog = new CatalogBuilder(prisma);
  let n = 0;
  const popularity = () => ((n++ * 37) % 100) / 100;
  for (const game of library) await catalog.game({ ...game, popularity: popularity() });
  for (const { prefix, count, spec } of families) {
    for (let i = 1; i <= count; i++) {
      await catalog.game({ ...spec, name: `${prefix} ${i}`, popularity: popularity() });
    }
  }
  // O IDF vem da ingestão; aqui todo atributo vale 1.
  await prisma.feature.updateMany({ data: { idf: 1 } });
  return catalog;
}

// A biblioteca e a preferência por Quebra-cabeça, gravadas direto pelo Prisma, e não pela API: só
// assim a ordem das linhas e as datas ficam sob controle. As datas são fixas porque desempatam as
// prateleiras "Porque você gostou de"; a ordem inversa grava o mesmo estado em outra ordem física.
export async function writeLibrary(
  prisma: PrismaService,
  userId: string,
  { reverse = false } = {},
) {
  const games = await prisma.game.findMany({ select: { id: true, name: true } });
  const idOf = (name: string) => games.find((game) => game.name === name)!.id;
  const entries = library.map(({ name, score, lists = [] }, i) => ({
    gameId: idOf(name),
    score,
    lists,
    at: new Date(Date.UTC(2026, 0, 1 + i)),
  }));
  const ordered = reverse ? [...entries].reverse() : entries;

  await prisma.rating.deleteMany({ where: { userId } });
  await prisma.listEntry.deleteMany({ where: { userId } });
  await prisma.userPreference.deleteMany({ where: { userId } });
  for (const { gameId, score, at } of ordered) {
    if (score !== undefined) {
      await prisma.rating.create({ data: { userId, gameId, score, updatedAt: at } });
    }
  }
  for (const { gameId, lists, at } of ordered) {
    for (const listType of lists) {
      await prisma.listEntry.create({ data: { userId, gameId, listType, createdAt: at } });
    }
  }
  const puzzle = await prisma.feature.findFirstOrThrow({
    where: { type: FeatureType.GENRE, slug: 'puzzle' },
  });
  await prisma.userPreference.create({ data: { userId, featureId: puzzle.id } });
}
