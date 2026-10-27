import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Usuários e sessões no banco', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => prisma.$executeRaw`TRUNCATE "User" CASCADE`);

  afterAll(() => app.close());

  const user = (email = 'jogadora@example.com') =>
    prisma.user.create({ data: { email, passwordHash: 'hash', displayName: 'Jogadora' } });

  it('cria o usuário com papel e modo de descoberta padrão', async () => {
    expect(await user()).toMatchObject({ role: 'USER', discoveryMode: 'BALANCED' });
  });

  it('recusa um segundo usuário com o mesmo e-mail', async () => {
    await user();

    await expect(user()).rejects.toMatchObject({ code: 'P2002' });
  });

  it('apaga as sessões junto com o usuário', async () => {
    const { id } = await user();
    await prisma.session.create({
      data: { userId: id, tokenHash: 'hash-do-token', expiresAt: new Date(Date.now() + 60_000) },
    });

    await prisma.user.delete({ where: { id } });

    expect(await prisma.session.count()).toBe(0);
  });
});
