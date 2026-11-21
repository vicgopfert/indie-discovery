import { ApiErrorSchema } from '@indie/contracts';
import { type INestApplication, type LoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { BackgroundTasks } from '../src/common/background-tasks';
import { AuthService } from '../src/modules/auth/auth.service';
import { MAILER } from '../src/modules/mail/mailer';
import { PrismaService } from '../src/prisma/prisma.service';
import { FakeMailer } from './support/fake-mailer';

describe('Proteções HTTP', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let origin: string;
  let mailer: FakeMailer;

  // Uma aplicação nova por teste zera os contadores do throttler, que ficam na memória.
  beforeEach(async () => {
    mailer = new FakeMailer();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAILER)
      .useValue(mailer)
      .compile();
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
  const requestReset = (email: string) =>
    server().post('/api/auth/password-reset/request').set('Origin', origin).send({ email });
  const confirmReset = (token = 'token-inventado', password = 'senha-nova-forte') =>
    server()
      .post('/api/auth/password-reset/confirm')
      .set('Origin', origin)
      .send({ token, password });
  const confirmEmail = (token = 'token-inventado') =>
    server().post('/api/auth/email-confirmation/confirm').set('Origin', origin).send({ token });
  // A redefinição só vai para endereço confirmado (B-98): confirma como a rota faria e tira da
  // lista o e-mail de confirmação do cadastro.
  const registerConfirmed = async (index: number) => {
    await register(index);
    await app.get(BackgroundTasks).drain();
    await prisma.user.updateMany({ data: { emailConfirmedAt: new Date() } });
    await prisma.accountToken.deleteMany();
    mailer.clear();
  };

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

    it('o 6º pedido de redefinição do mesmo IP na mesma hora recebe 429', async () => {
      for (let index = 0; index < 5; index++) {
        expect((await requestReset(`jogadora${index}@example.com`)).status).toBe(202);
      }

      expect((await requestReset('jogadora5@example.com')).status).toBe(429);
    });

    it('a 6ª tentativa de link de redefinição no mesmo minuto recebe 429', async () => {
      for (let attempt = 0; attempt < 5; attempt++) expect((await confirmReset()).status).toBe(400);

      expect((await confirmReset()).status).toBe(429);
    });

    it('a 6ª tentativa de link de confirmação no mesmo minuto recebe 429', async () => {
      for (let attempt = 0; attempt < 5; attempt++) expect((await confirmEmail()).status).toBe(400);

      expect((await confirmEmail()).status).toBe(429);
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

    it('o 4º pedido de redefinição para o mesmo e-mail na mesma hora recebe 429, mesmo de IPs diferentes', async () => {
      const resetFromIp = (attempt: number, email = 'jogadora@example.com') =>
        requestReset(email).set('X-Forwarded-For', `203.0.113.${attempt}`);
      for (let attempt = 1; attempt <= 3; attempt++) {
        expect((await resetFromIp(attempt)).status).toBe(202);
      }

      expect((await resetFromIp(4, ' JOGADORA@Example.com ')).status).toBe(429);
      expect((await resetFromIp(5, 'outra@example.com')).status).toBe(202);
    });
  });

  describe('reenvio da confirmação do e-mail', () => {
    // Cada conta é criada de um IP diferente, para o limite do cadastro não barrar.
    beforeEach(() => (app.getHttpAdapter().getInstance() as Application).set('trust proxy', 1));
    const accountFrom = async (index: number) => {
      const response = await register(index).set('X-Forwarded-For', `198.51.100.${index}`);
      return String(response.headers['set-cookie']).split(';')[0]!;
    };
    const resend = (cookie: string, ip: string) =>
      server()
        .post('/api/auth/email-confirmation/request')
        .set('Origin', origin)
        .set('Cookie', cookie)
        .set('X-Forwarded-For', ip);

    it('o 4º reenvio da mesma conta na mesma hora recebe 429, mesmo de IPs diferentes', async () => {
      const [jogadora, outra] = [await accountFrom(0), await accountFrom(1)];
      for (let attempt = 1; attempt <= 3; attempt++) {
        expect((await resend(jogadora, `203.0.113.${attempt}`)).status).toBe(202);
      }

      expect((await resend(jogadora, '203.0.113.4')).status).toBe(429);
      expect((await resend(outra, '203.0.113.5')).status).toBe(202);
    });

    it('o 6º reenvio do mesmo IP na mesma hora recebe 429, mesmo de contas diferentes', async () => {
      const cookies = [];
      for (let index = 0; index < 6; index++) cookies.push(await accountFrom(index));
      for (const cookie of cookies.slice(0, 5)) {
        expect((await resend(cookie, '203.0.113.9')).status).toBe(202);
      }

      expect((await resend(cookies[5]!, '203.0.113.9')).status).toBe(429);
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

    it('não registra o link de redefinição, a senha nova nem o e-mail de quem pediu', async () => {
      await registerConfirmed(0);
      const lines = captureLogs();
      const password = 'senha-nova-que-nao-pode-vazar';

      await requestReset('jogadora0@example.com');
      await app.get(BackgroundTasks).drain();
      const token = /#([\w-]+)/.exec(mailer.sent[0]!.text)![1]!;
      expect((await confirmReset(token, password)).status).toBe(204);
      await app.get(BackgroundTasks).drain();

      expect(lines.some((line) => line.includes('/api/auth/password-reset/confirm'))).toBe(true);
      const log = lines.join('\n');
      expect(log).not.toContain(token);
      expect(log).not.toContain(password);
      expect(log).not.toContain('jogadora0@example.com');
    });

    it('não registra o link de confirmação nem o e-mail de quem se cadastrou', async () => {
      const lines = captureLogs();

      await register(0);
      await app.get(BackgroundTasks).drain();
      const token = /#([\w-]+)/.exec(mailer.sent[0]!.text)![1]!;
      expect((await confirmEmail(token)).status).toBe(204);

      expect(lines.some((line) => line.includes('/api/auth/email-confirmation/confirm'))).toBe(
        true,
      );
      const log = lines.join('\n');
      expect(log).not.toContain(token);
      expect(log).not.toContain('jogadora0@example.com');
    });

    it('falha no envio: o pedido responde normalmente, e o log fica só com o tipo e o código', async () => {
      await registerConfirmed(0);
      const lines = captureLogs();
      jest
        .spyOn(mailer, 'send')
        .mockRejectedValue(
          Object.assign(new Error('recusado para jogadora0@example.com'), { code: 'HTTP_422' }),
        );

      const response = await requestReset('jogadora0@example.com');
      await app.get(BackgroundTasks).drain();

      expect(response.status).toBe(202);
      const log = lines.join('\n');
      expect(log).toContain('Falha em \\"pedido de redefinição de senha\\": Error (HTTP_422)');
      expect(log).not.toContain('jogadora0@example.com');
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
