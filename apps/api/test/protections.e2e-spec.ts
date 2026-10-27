import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Proteções HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;

  // Uma aplicação nova por teste zera os contadores do throttler, que ficam na memória.
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    origin = app.get(ConfigService).getOrThrow<string>('WEB_ORIGIN');
    await prisma.$executeRaw`TRUNCATE "User" CASCADE`;
  });

  afterEach(() => app.close());

  const server = () => request(app.getHttpServer());
  const login = () =>
    server()
      .post('/api/auth/login')
      .set('Origin', origin)
      .send({ email: 'ninguem@example.com', password: 'qualquer' });
  const register = (index: number) =>
    server()
      .post('/api/auth/register')
      .set('Origin', origin)
      .send({
        email: `jogadora${index}@example.com`,
        displayName: 'Jogadora',
        password: 'senha-forte',
      });

  describe('throttler', () => {
    it('a 6ª tentativa de login no mesmo minuto recebe 429', async () => {
      for (let attempt = 0; attempt < 5; attempt++) expect((await login()).status).toBe(401);

      const response = await login();

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        statusCode: 429,
        message: 'Muitas tentativas; aguarde um pouco e tente de novo',
      });
      expect(response.headers['retry-after-auth']).toBeDefined();
    });

    it('o 6º cadastro na mesma hora recebe 429, sem criar a conta', async () => {
      for (let index = 0; index < 5; index++) expect((await register(index)).status).toBe(201);

      expect((await register(5)).status).toBe(429);
      expect(await prisma.user.count()).toBe(5);
    });

    it('login e cadastro têm contadores separados', async () => {
      for (let attempt = 0; attempt < 5; attempt++) await login();

      expect((await register(0)).status).toBe(201);
    });
  });

  describe('origem', () => {
    it.each([
      ['de outro site', 'https://atacante.example'],
      ['sem Origin', undefined],
    ])('recusa POST %s com 403, antes de conferir a sessão', async (_, sentOrigin) => {
      const call = server().post('/api/auth/logout');
      const response = await (sentOrigin ? call.set('Origin', sentOrigin) : call);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ message: 'Origem da requisição não permitida' });
    });

    it('cadastro de outro site não cria conta', async () => {
      await server()
        .post('/api/auth/register')
        .set('Origin', 'https://atacante.example')
        .send({ email: 'jogadora@example.com', displayName: 'Jogadora', password: 'senha-forte' })
        .expect(403);

      expect(await prisma.user.count()).toBe(0);
    });

    it('leitura não exige Origin', async () => {
      await server().get('/api/health').expect(200);
    });
  });

  describe('respostas', () => {
    it('todo erro sai com statusCode, error, message e o requestId do cabeçalho', async () => {
      const response = await server().get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Sessão ausente ou expirada',
        requestId: response.headers['x-request-id'],
      });
    });

    it('rota inexistente também segue o formato', async () => {
      const response = await server().get('/api/nao-existe');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        requestId: response.headers['x-request-id'],
      });
    });

    it('erro de validação lista as mensagens dos campos', async () => {
      const response = await server()
        .post('/api/auth/register')
        .set('Origin', origin)
        .send({ email: 'não-é-email', displayName: 'Jogadora', password: 'senha-forte' });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ message: [expect.stringMatching(/^email: /)] });
    });

    it('reaproveita o x-request-id de quem chamou', async () => {
      const response = await server().get('/api/health').set('x-request-id', 'trace-abc-123');

      expect(response.headers['x-request-id']).toBe('trace-abc-123');
    });

    it('envia os cabeçalhos de segurança do helmet', async () => {
      const response = await server().get('/api/health');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toMatch(/default-src 'self'/);
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });
});
