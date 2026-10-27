import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Autenticação', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;

  beforeAll(async () => {
    // O limite por IP tem e2e próprio; aqui ele atrapalharia os vários cadastros seguidos.
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    origin = app.get(ConfigService).getOrThrow<string>('WEB_ORIGIN');
  });

  beforeEach(() => prisma.$executeRaw`TRUNCATE "User" CASCADE`);

  afterAll(() => app.close());

  const register = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/auth/register').set('Origin', origin).send(body);

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

  const server = () => request(app.getHttpServer());
  const sessionCookie = (response: request.Response) =>
    ([] as string[])
      .concat(response.headers['set-cookie'] ?? [])
      .find((cookie) => cookie.startsWith('sid='));
  const login = (email: string, password: string) =>
    server().post('/api/auth/login').set('Origin', origin).send({ email, password });
  const me = (cookie?: string) =>
    cookie ? server().get('/api/auth/me').set('Cookie', cookie) : server().get('/api/auth/me');

  describe('sessão', () => {
    it('o cadastro já abre a sessão, com cookie HttpOnly, SameSite=Lax e 7 dias', async () => {
      const cookie = sessionCookie(await register(valid));

      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/Max-Age=604800/);
      expect((await me(cookie)).body).toMatchObject({ email: 'jogadora@example.com' });
    });

    it('o banco guarda só o hash do token do cookie', async () => {
      const cookie = sessionCookie(await register(valid))!;
      const token = decodeURIComponent(cookie.split(';')[0]!.slice('sid='.length));

      const session = await prisma.session.findFirstOrThrow();
      expect(session.tokenHash).not.toBe(token);
      expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('login com a senha certa abre outra sessão', async () => {
      await register(valid);

      const response = await login('JOGADORA@example.com', 'senha-forte');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ email: 'jogadora@example.com' });
      expect((await me(sessionCookie(response))).status).toBe(200);
      expect(await prisma.session.count()).toBe(2);
    });

    it.each([
      ['senha errada', 'jogadora@example.com', 'outra-senha'],
      ['e-mail sem conta', 'ninguem@example.com', 'senha-forte'],
    ])('login com %s responde 401 com a mesma mensagem, sem cookie', async (_, email, password) => {
      await register(valid);

      const response = await login(email, password);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ message: 'E-mail ou senha incorretos' });
      expect(sessionCookie(response)).toBeUndefined();
    });

    it('rota protegida responde 401 sem cookie ou com cookie inválido', async () => {
      expect((await me()).status).toBe(401);
      expect((await me('sid=token-inventado')).status).toBe(401);
    });

    it('logout encerra a sessão no servidor e apaga o cookie', async () => {
      const cookie = sessionCookie(await register(valid))!;

      const response = await server()
        .post('/api/auth/logout')
        .set('Origin', origin)
        .set('Cookie', cookie);

      expect(response.status).toBe(204);
      expect(sessionCookie(response)).toMatch(/sid=;.*Expires=Thu, 01 Jan 1970/);
      expect(await prisma.session.count()).toBe(0);
      expect((await me(cookie)).status).toBe(401);
    });

    it('sessão expirada responde 401', async () => {
      const cookie = sessionCookie(await register(valid));
      await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

      expect((await me(cookie)).status).toBe(401);
    });

    it('o health check continua público', async () => {
      expect((await server().get('/api/health')).status).toBe(200);
    });
  });
});
