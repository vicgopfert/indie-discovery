import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Autenticação', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(() => prisma.$executeRaw`TRUNCATE "User" CASCADE`);

  afterAll(() => app.close());

  const register = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/auth/register').send(body);

  const valid = {
    email: 'Jogadora@Example.com ',
    displayName: ' Jogadora ',
    password: 'senha-forte',
  };

  describe('POST /api/auth/register', () => {
    it('cria a conta com o e-mail normalizado e devolve o usuário sem a senha', async () => {
      const response = await register(valid);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        email: 'jogadora@example.com',
        displayName: 'Jogadora',
        role: 'USER',
        discoveryMode: 'BALANCED',
      });
      expect(JSON.stringify(response.body)).not.toMatch(/senha-forte|passwordHash|argon2/);
    });

    it('guarda a senha com Argon2id nos parâmetros da OWASP', async () => {
      await register(valid);

      const user = await prisma.user.findUniqueOrThrow({
        where: { email: 'jogadora@example.com' },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    });

    it('recusa o mesmo e-mail com outra grafia, com 409', async () => {
      await register(valid);

      const response = await register({ ...valid, email: 'JOGADORA@example.com' });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ message: 'E-mail já cadastrado' });
      expect(await prisma.user.count()).toBe(1);
    });

    it.each([
      ['e-mail inválido', { ...valid, email: 'não-é-email' }],
      ['senha curta', { ...valid, password: '1234567' }],
      ['senha longa demais', { ...valid, password: 'x'.repeat(129) }],
      ['nome vazio', { ...valid, displayName: '   ' }],
      ['campo faltando', { email: valid.email, password: valid.password }],
    ])('recusa %s com 400, sem criar conta', async (_, body) => {
      const response = await register(body);

      expect(response.status).toBe(400);
      expect(await prisma.user.count()).toBe(0);
    });
  });
});
