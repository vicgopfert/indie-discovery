import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { ListType } from '../src/generated/prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { CatalogBuilder } from './support/catalog-builder';

describe('Avaliações, listas e preferências no banco', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let userId: string;
  let gameId: string;
  let featureId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "User", "Game", "Feature" CASCADE`;
    userId = (
      await prisma.user.create({
        data: { email: 'jogadora@example.com', passwordHash: 'hash', displayName: 'Jogadora' },
      })
    ).id;
    gameId = (await new CatalogBuilder(prisma).game({ name: 'Celeste', genres: ['Platform'] })).id;
    featureId = (await prisma.feature.findFirstOrThrow()).id;
  });

  afterAll(() => app.close());

  const rate = (score: number) => prisma.rating.create({ data: { userId, gameId, score } });
  const addToList = (listType: ListType) =>
    prisma.listEntry.create({ data: { userId, gameId, listType } });

  it('aceita notas de 1 a 5', async () => {
    await rate(1);
    await prisma.rating.update({
      where: { userId_gameId: { userId, gameId } },
      data: { score: 5 },
    });

    expect(await prisma.rating.findMany()).toMatchObject([{ score: 5 }]);
  });

  it('recusa nota fora de 1 a 5, mesmo gravada por fora da API', async () => {
    for (const score of [0, 6]) {
      await expect(rate(score)).rejects.toThrow('Rating_score_check');
    }
  });

  it('recusa uma segunda avaliação do mesmo jogo pelo mesmo usuário', async () => {
    await rate(4);

    await expect(rate(2)).rejects.toMatchObject({ code: 'P2002' });
  });

  it('põe o jogo em listas diferentes, mas só uma vez em cada', async () => {
    await addToList(ListType.FAVORITE);
    await addToList(ListType.COMPLETED);

    await expect(addToList(ListType.FAVORITE)).rejects.toMatchObject({ code: 'P2002' });
    expect(await prisma.listEntry.count()).toBe(2);
  });

  it('recusa a mesma preferência duas vezes', async () => {
    const prefer = () => prisma.userPreference.create({ data: { userId, featureId } });
    await prefer();

    await expect(prefer()).rejects.toMatchObject({ code: 'P2002' });
  });

  it('apaga avaliações, listas e preferências junto com o usuário', async () => {
    await rate(3);
    await addToList(ListType.WANT_TO_PLAY);
    await prisma.userPreference.create({ data: { userId, featureId } });

    await prisma.user.delete({ where: { id: userId } });

    expect(
      await Promise.all([
        prisma.rating.count(),
        prisma.listEntry.count(),
        prisma.userPreference.count(),
      ]),
    ).toEqual([0, 0, 0]);
  });

  it('impede apagar um jogo avaliado ou em lista', async () => {
    await rate(3);

    await expect(prisma.game.delete({ where: { id: gameId } })).rejects.toMatchObject({
      code: 'P2003',
    });

    await prisma.rating.deleteMany();
    await addToList(ListType.FAVORITE);

    await expect(prisma.game.delete({ where: { id: gameId } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });

  it('impede apagar um atributo escolhido como preferência', async () => {
    await prisma.gameFeature.deleteMany();
    await prisma.userPreference.create({ data: { userId, featureId } });

    await expect(prisma.feature.delete({ where: { id: featureId } })).rejects.toMatchObject({
      code: 'P2003',
    });
  });
});
