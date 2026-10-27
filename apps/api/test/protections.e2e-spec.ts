import { ApiErrorSchema } from '@indie/contracts';
import { type INestApplication, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { AuthService } from '../src/modules/auth/auth.service';
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
  const login = (email = 'ninguem@example.com') =>
    server().post('/api/auth/login').set('Origin', origin).send({ email, password: 'qualquer' });
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
      expect(response.headers['retry-after-ip']).toBeDefined();
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

    it('sem proxies confiáveis, ignora o X-Forwarded-For enviado pelo cliente', async () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        await login().set('X-Forwarded-For', `203.0.113.${attempt}`);
      }

      expect((await login().set('X-Forwarded-For', '203.0.113.6')).status).toBe(429);
    });

    it('atrás de proxies, conta pelo IP a TRUST_PROXY_HOPS saltos da direita', async () => {
      // Simula TRUST_PROXY_HOPS=1: o último proxy anexa o IP real à direita do que o cliente mandou.
      (app.getHttpAdapter().getInstance() as Application).set('trust proxy', 1);
      const fromClient = (forged: string) =>
        login().set('X-Forwarded-For', `${forged}, 198.51.100.9`);

      for (let attempt = 1; attempt <= 5; attempt++) await fromClient(`203.0.113.${attempt}`);

      expect((await fromClient('203.0.113.6')).status).toBe(429);
      expect((await login().set('X-Forwarded-For', '198.51.100.10')).status).toBe(401);
    });
  });

  describe('limite por conta', () => {
    // Cada tentativa de um IP diferente: só o limite por conta pode barrar.
    beforeEach(() => (app.getHttpAdapter().getInstance() as Application).set('trust proxy', 1));
    const fromIp = (attempt: number, email = 'jogadora@example.com') =>
      login(email).set('X-Forwarded-For', `203.0.113.${attempt}`);

    it('a 11ª tentativa na mesma conta em 15 minutos recebe 429, mesmo de IPs diferentes', async () => {
      for (let attempt = 1; attempt <= 10; attempt++) {
        expect((await fromIp(attempt)).status).toBe(401);
      }

      const response = await fromIp(11);

      expect(response.status).toBe(429);
      expect(response.headers['retry-after-account']).toBeDefined();
    });

    it('conta o e-mail normalizado, com outra grafia', async () => {
      for (let attempt = 1; attempt <= 10; attempt++) await fromIp(attempt);

      expect((await fromIp(11, ' JOGADORA@Example.com ')).status).toBe(429);
    });

    it('não afeta outra conta', async () => {
      for (let attempt = 1; attempt <= 10; attempt++) await fromIp(attempt);

      expect((await fromIp(11, 'outra@example.com')).status).toBe(401);
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

  // Guarda tudo o que a aplicação registraria no log, como texto.
  function captureLogs() {
    const lines: string[] = [];
    const record = (...parts: unknown[]) => void lines.push(JSON.stringify(parts));
    const logger: LoggerService = { log: record, error: record, warn: record, debug: record };
    app.useLogger(logger);
    return lines;
  }

  describe('log', () => {
    it('não registra a senha nem o token da sessão', async () => {
      const lines = captureLogs();
      const password = 'senha-que-nao-pode-vazar';

      const registered = await server()
        .post('/api/auth/register')
        .set('Origin', origin)
        .send({ email: 'jogadora@example.com', displayName: 'Jogadora', password });
      const loggedIn = await server()
        .post('/api/auth/login')
        .set('Origin', origin)
        .send({ email: 'jogadora@example.com', password });
      const tokens = [registered, loggedIn].map((response) =>
        String(response.headers['set-cookie']).split(';')[0]!.slice('sid='.length),
      );

      expect(lines.some((line) => line.includes('/api/auth/login'))).toBe(true);
      const log = lines.join('\n');
      expect(log).not.toContain(password);
      for (const token of tokens) expect(log).not.toContain(token);
    });
  });

  describe('respostas', () => {
    it('erro inesperado responde só a mensagem genérica e deixa o detalhe no log', async () => {
      const lines = captureLogs();
      jest
        .spyOn(app.get(AuthService), 'login')
        .mockRejectedValue(new Error('conexão recusada em 10.0.0.5:5432'));

      const response = await login();

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Erro interno; tente novamente mais tarde',
        requestId: response.headers['x-request-id'],
      });
      const detail = lines.find((line) => line.includes('conexão recusada'));
      expect(detail).toContain(String(response.headers['x-request-id']));
    });

    it('todo erro sai com statusCode, error, message e o requestId do cabeçalho', async () => {
      const response = await server().get('/api/auth/me');

      expect(ApiErrorSchema.safeParse(response.body).success).toBe(true);
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
      expect(ApiErrorSchema.safeParse(response.body).success).toBe(true);
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
