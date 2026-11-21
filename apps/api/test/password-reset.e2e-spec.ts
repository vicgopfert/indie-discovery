import { createHash } from 'node:crypto';
import { INVALID_RESET_LINK_MESSAGE } from '@indie/contracts';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import { BackgroundTasks } from '../src/common/background-tasks';
import { MAILER } from '../src/modules/mail/mailer';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, sessionHelpers } from './support/e2e-app';
import { FakeMailer } from './support/fake-mailer';

const EMAIL = 'jogadora@example.com';
const OLD_PASSWORD = 'senha-forte';
const NEW_PASSWORD = 'senha-nova-forte';
const HOUR_MS = 3_600_000;

describe('Redefinição de senha', () => {
  const mailer = new FakeMailer();
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tasks: BackgroundTasks;
  let origin: string;
  let helpers: ReturnType<typeof sessionHelpers>;

  beforeAll(async () => {
    app = await createApp((builder) => builder.overrideProvider(MAILER).useValue(mailer));
    prisma = app.get(PrismaService);
    tasks = app.get(BackgroundTasks);
    origin = app.get(ConfigService).getOrThrow<string>('WEB_ORIGIN');
    helpers = sessionHelpers(app);
  });

  beforeEach(async () => {
    await prisma.$executeRaw`TRUNCATE "User" CASCADE`;
    mailer.clear();
  });

  afterAll(() => app.close());

  const server = () => request(app.getHttpServer());
  const sendRequest = (email: string) =>
    server().post('/api/auth/password-reset/request').set('Origin', origin).send({ email });
  const requestReset = async (email: string) => {
    const response = await sendRequest(email);
    await tasks.drain();
    return response;
  };
  const tokenOf = (text: string) => /\/redefinir-senha#([\w-]+)/.exec(text)?.[1];
  const requestToken = async (email = EMAIL) => {
    mailer.clear();
    await requestReset(email);
    return tokenOf(mailer.sent[0]!.text)!;
  };
  const confirm = async (token: string, password = NEW_PASSWORD) => {
    const response = await server()
      .post('/api/auth/password-reset/confirm')
      .set('Origin', origin)
      .send({ token, password });
    await tasks.drain();
    return response;
  };
  // A redefinição só vai para endereço confirmado (B-98). Confirma como a rota faria, gravando a
  // data e apagando o token, e tira da lista o e-mail de confirmação do cadastro.
  const confirmEmails = async () => {
    await tasks.drain();
    await prisma.user.updateMany({ data: { emailConfirmedAt: new Date() } });
    await prisma.accountToken.deleteMany({ where: { purpose: 'EMAIL_CONFIRMATION' } });
  };
  const registerConfirmed = async (email: string) => {
    const cookie = await helpers.register(email);
    await confirmEmails();
    mailer.clear();
    return cookie;
  };
  const login = (password: string) =>
    server().post('/api/auth/login').set('Origin', origin).send({ email: EMAIL, password });

  describe('pedido', () => {
    it('responde 202 sem corpo e envia o link para o e-mail normalizado da conta', async () => {
      await registerConfirmed(EMAIL);

      const response = await requestReset(' Jogadora@Example.com ');

      expect(response.status).toBe(202);
      expect(response.text).toBe('');
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]).toMatchObject({
        to: EMAIL,
        subject: 'Redefinição de senha da Penumbra',
      });
      expect(mailer.sent[0]!.text).toContain(`${origin}/redefinir-senha#`);
    });

    it('e-mail sem conta recebe a mesma resposta, sem e-mail enviado e sem token gravado', async () => {
      await registerConfirmed(EMAIL);
      const withAccount = await requestReset(EMAIL);
      mailer.clear();

      const withoutAccount = await requestReset('ninguem@example.com');

      expect(withoutAccount.status).toBe(withAccount.status);
      expect(withoutAccount.text).toBe(withAccount.text);
      expect(withoutAccount.headers['content-type']).toBe(withAccount.headers['content-type']);
      expect(mailer.sent).toEqual([]);
      expect(await prisma.accountToken.count()).toBe(1);
    });

    it('responde antes de buscar a conta e enviar o e-mail', async () => {
      await registerConfirmed(EMAIL);
      const release = mailer.hold();

      const response = await sendRequest(EMAIL);

      expect(response.status).toBe(202);
      expect(mailer.sent).toEqual([]);
      release();
      await tasks.drain();
      expect(mailer.sent).toHaveLength(1);
    });

    it('o banco guarda só o SHA-256 do token, com validade de 60 minutos', async () => {
      await registerConfirmed(EMAIL);
      const before = Date.now();

      const token = await requestToken();

      const saved = await prisma.accountToken.findFirstOrThrow();
      expect(token).toMatch(/^[\w-]{43}$/);
      expect(saved.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
      expect(saved.purpose).toBe('PASSWORD_RESET');
      expect(saved.expiresAt.getTime()).toBeGreaterThanOrEqual(before + HOUR_MS);
      expect(saved.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + HOUR_MS);
    });

    it('monta o link com o WEB_ORIGIN, nunca com o Host enviado', async () => {
      await registerConfirmed(EMAIL);

      await server()
        .post('/api/auth/password-reset/request')
        .set('Origin', origin)
        .set('Host', 'atacante.example')
        .send({ email: EMAIL });
      await tasks.drain();

      expect(mailer.sent[0]!.text).toContain(`${origin}/redefinir-senha#`);
      expect(mailer.sent[0]!.text).not.toContain('atacante.example');
    });

    it('um pedido novo invalida o link anterior', async () => {
      await registerConfirmed(EMAIL);
      const first = await requestToken();
      const second = await requestToken();

      expect((await confirm(first)).status).toBe(400);
      expect((await confirm(second)).status).toBe(204);
    });

    it('dois pedidos simultâneos deixam um só link válido', async () => {
      await registerConfirmed(EMAIL);

      await Promise.all([sendRequest(EMAIL), sendRequest(EMAIL)]);
      await tasks.drain();

      const saved = await prisma.accountToken.findMany();
      const hashes = mailer.sent.map(({ text }) =>
        createHash('sha256').update(tokenOf(text)!).digest('hex'),
      );
      expect(saved).toHaveLength(1);
      expect(hashes.filter((hash) => hash === saved[0]!.tokenHash)).toHaveLength(1);
    });

    it('nenhum texto digitado pelo usuário entra nos e-mails de conta', async () => {
      const scam = 'Conta suspensa, acesse golpe.example';
      await server()
        .post('/api/auth/register')
        .set('Origin', origin)
        .send({ email: EMAIL, displayName: scam, password: OLD_PASSWORD })
        .expect(201);
      await requestReset(EMAIL);
      const confirmation = /\/confirmar-email#([\w-]+)/.exec(mailer.sent.at(-1)!.text)![1]!;
      await server()
        .post('/api/auth/email-confirmation/confirm')
        .set('Origin', origin)
        .send({ token: confirmation })
        .expect(204);
      await requestReset(EMAIL);
      await confirm(tokenOf(mailer.sent.at(-1)!.text)!);

      expect(mailer.sent.map(({ subject }) => subject)).toEqual([
        'Confirme o seu e-mail na Penumbra',
        'Redefinição de senha da Penumbra: confirme o seu e-mail antes',
        'Redefinição de senha da Penumbra',
        'A sua senha da Penumbra foi alterada',
      ]);
      for (const { text } of mailer.sent) {
        expect(text.startsWith('Olá.\n')).toBe(true);
        expect(text).not.toContain('golpe.example');
      }
    });

    it('pedido vindo de outro site recebe 403 e não envia e-mail', async () => {
      await registerConfirmed(EMAIL);

      const response = await server()
        .post('/api/auth/password-reset/request')
        .set('Origin', 'https://atacante.example')
        .send({ email: EMAIL });
      await tasks.drain();

      expect(response.status).toBe(403);
      expect(mailer.sent).toEqual([]);
    });
  });

  describe('confirmação', () => {
    it('troca a senha, encerra as sessões de todos os aparelhos e não abre outra', async () => {
      const firstDevice = await registerConfirmed(EMAIL);
      const secondDevice = String((await login(OLD_PASSWORD)).headers['set-cookie']).split(';')[0]!;
      const token = await requestToken();

      const response = await confirm(token);

      expect(response.status).toBe(204);
      expect(String(response.headers['set-cookie'])).toMatch(/sid=;.*Expires=Thu, 01 Jan 1970/);
      expect(await prisma.session.count()).toBe(0);
      for (const cookie of [firstDevice, secondDevice]) {
        expect((await helpers.as(cookie).get('/api/auth/me')).status).toBe(401);
      }
      expect((await login(OLD_PASSWORD)).status).toBe(401);
      expect((await login(NEW_PASSWORD)).status).toBe(200);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    });

    it('avisa por e-mail que a senha foi alterada, sem link de redefinição', async () => {
      await registerConfirmed(EMAIL);
      const token = await requestToken();
      mailer.clear();

      await confirm(token);

      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]).toMatchObject({
        to: EMAIL,
        subject: 'A sua senha da Penumbra foi alterada',
      });
      expect(tokenOf(mailer.sent[0]!.text)).toBeUndefined();
      expect(mailer.sent[0]!.text).toContain(`${origin}/esqueci-senha`);
    });

    it.each([
      [
        'já usado',
        async (token: string) => {
          await confirm(token);
          return token;
        },
        NEW_PASSWORD,
      ],
      [
        'vencido',
        async (token: string) => {
          await prisma.accountToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
          return token;
        },
        OLD_PASSWORD,
      ],
      ['inventado', () => Promise.resolve('token-inventado'), OLD_PASSWORD],
    ])(
      'link %s recebe a mesma resposta 400 e não troca a senha',
      async (_, prepare, currentPassword) => {
        await registerConfirmed(EMAIL);
        const token = await prepare(await requestToken());
        mailer.clear();

        const response = await confirm(token, 'outra-senha-forte');

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ message: INVALID_RESET_LINK_MESSAGE });
        expect(mailer.sent).toEqual([]);
        expect((await login(currentPassword)).status).toBe(200);
      },
    );

    it('senha fora da regra do cadastro responde 400 sem gastar o link', async () => {
      await registerConfirmed(EMAIL);
      const token = await requestToken();

      const response = await confirm(token, '1234567');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        message: ['password: A senha tem no mínimo 8 caracteres.'],
      });
      expect((await confirm(token)).status).toBe(204);
    });

    it('dois envios simultâneos com o mesmo link: só um troca a senha', async () => {
      await registerConfirmed(EMAIL);
      const token = await requestToken();

      const responses = await Promise.all([
        confirm(token, 'senha-da-primeira-aba'),
        confirm(token, 'senha-da-segunda-aba'),
      ]);

      expect(responses.map(({ status }) => status).sort()).toEqual([204, 400]);
      const winner = responses[0].status === 204 ? 'primeira' : 'segunda';
      expect((await login(`senha-da-${winner}-aba`)).status).toBe(200);
    });
  });
});
