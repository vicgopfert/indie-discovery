import { createHash } from 'node:crypto';
import { INVALID_CONFIRMATION_LINK_MESSAGE, UserSchema } from '@indie/contracts';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import type { App } from 'supertest/types';
import { BackgroundTasks } from '../src/common/background-tasks';
import { PasswordChanger } from '../src/modules/auth/password-changer';
import { MAILER } from '../src/modules/mail/mailer';
import { PrismaService } from '../src/prisma/prisma.service';
import { createApp, sessionHelpers } from './support/e2e-app';
import { FakeMailer } from './support/fake-mailer';

const EMAIL = 'jogadora@example.com';
const DAY_MS = 86_400_000;
const CONFIRMATION_SUBJECT = 'Confirme o seu e-mail na Penumbra';

describe('Confirmação do e-mail (B-98)', () => {
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
  const tokenOf = (text: string) => /\/confirmar-email#([\w-]+)/.exec(text)?.[1];
  const lastToken = () => tokenOf(mailer.sent.at(-1)!.text)!;
  const register = async (email = EMAIL) => {
    const cookie = await helpers.register(email);
    await tasks.drain();
    return cookie;
  };
  const resend = async (cookie: string) => {
    const response = await helpers.as(cookie).post('/api/auth/email-confirmation/request');
    await tasks.drain();
    return response;
  };
  const confirm = (token: string) =>
    server().post('/api/auth/email-confirmation/confirm').set('Origin', origin).send({ token });
  const me = async (cookie: string) =>
    UserSchema.parse((await helpers.as(cookie).get('/api/auth/me')).body);
  const requestReset = async (email = EMAIL) => {
    const response = await server()
      .post('/api/auth/password-reset/request')
      .set('Origin', origin)
      .send({ email });
    await tasks.drain();
    return response;
  };

  describe('cadastro', () => {
    it('envia o link de confirmação depois da resposta, e a conta já funciona sem ele', async () => {
      const release = mailer.hold();

      // Sem o helpers.register, que espera o envio terminar.
      const response = await server().post('/api/auth/register').set('Origin', origin).send({
        email: ' Jogadora@Example.com ',
        displayName: 'Jogadora',
        password: 'senha-forte',
      });
      const cookie = String(response.headers['set-cookie']).split(';')[0]!;

      expect(mailer.sent).toEqual([]);
      expect(await me(cookie)).toMatchObject({ email: EMAIL, emailConfirmedAt: null });
      release();
      await tasks.drain();
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]).toMatchObject({ to: EMAIL, subject: CONFIRMATION_SUBJECT });
      expect(mailer.sent[0]!.text).toContain(`${origin}/confirmar-email#`);
    });

    it('o banco guarda só o SHA-256 do token, com validade de 7 dias', async () => {
      const before = Date.now();

      await register();

      const token = lastToken();
      const saved = await prisma.accountToken.findFirstOrThrow();
      expect(token).toMatch(/^[\w-]{43}$/);
      expect(saved.tokenHash).toBe(createHash('sha256').update(token).digest('hex'));
      expect(saved.purpose).toBe('EMAIL_CONFIRMATION');
      expect(saved.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * DAY_MS);
      expect(saved.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 7 * DAY_MS);
    });

    it('cadastro recusado por e-mail repetido não envia outro link', async () => {
      await register();
      mailer.clear();

      await server()
        .post('/api/auth/register')
        .set('Origin', origin)
        .send({ email: EMAIL, displayName: 'Outra', password: 'senha-forte' })
        .expect(409);
      await tasks.drain();

      expect(mailer.sent).toEqual([]);
    });
  });

  describe('confirmação', () => {
    it('grava a data na conta, sem exigir sessão, e o /auth/me passa a mostrá-la', async () => {
      const cookie = await register();
      const before = Date.now();

      const response = await confirm(lastToken());

      expect(response.status).toBe(204);
      expect(response.headers['set-cookie']).toBeUndefined();
      const { emailConfirmedAt } = await me(cookie);
      expect(new Date(emailConfirmedAt!).getTime()).toBeGreaterThanOrEqual(before);
      expect(await prisma.accountToken.count()).toBe(0);
    });

    it.each([
      [
        'já usado',
        async (token: string) => {
          await confirm(token);
          return token;
        },
      ],
      [
        'vencido',
        async (token: string) => {
          await prisma.accountToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
          return token;
        },
      ],
      ['inventado', () => Promise.resolve('token-inventado')],
    ])('link %s recebe a mesma resposta 400', async (_, prepare) => {
      await register();
      const token = await prepare(lastToken());

      const response = await confirm(token);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ message: INVALID_CONFIRMATION_LINK_MESSAGE });
    });

    it('link vencido não confirma a conta', async () => {
      const cookie = await register();
      await prisma.accountToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });

      await confirm(lastToken());

      expect((await me(cookie)).emailConfirmedAt).toBeNull();
    });

    it('o link de redefinição de senha não confirma o e-mail', async () => {
      const cookie = await register();
      await prisma.accountToken.updateMany({ data: { purpose: 'PASSWORD_RESET' } });

      expect((await confirm(lastToken())).status).toBe(400);
      expect((await me(cookie)).emailConfirmedAt).toBeNull();
    });

    it('dois envios simultâneos do mesmo link: um confirma, o outro recebe 400', async () => {
      await register();
      const token = lastToken();

      const responses = await Promise.all([confirm(token), confirm(token)]);

      expect(responses.map(({ status }) => status).sort()).toEqual([204, 400]);
    });

    it('confirmação vinda de outro site recebe 403 e não confirma', async () => {
      const cookie = await register();

      const response = await server()
        .post('/api/auth/email-confirmation/confirm')
        .set('Origin', 'https://atacante.example')
        .send({ token: lastToken() });

      expect(response.status).toBe(403);
      expect((await me(cookie)).emailConfirmedAt).toBeNull();
    });
  });

  describe('reenvio', () => {
    it('responde 202 sem corpo e envia um link novo, que invalida o anterior', async () => {
      const cookie = await register();
      const first = lastToken();

      const response = await resend(cookie);

      expect(response.status).toBe(202);
      expect(response.text).toBe('');
      expect(mailer.sent).toHaveLength(2);
      const second = lastToken();
      expect(second).not.toBe(first);
      expect((await confirm(first)).status).toBe(400);
      expect((await confirm(second)).status).toBe(204);
    });

    it('conta já confirmada não recebe outro e-mail', async () => {
      const cookie = await register();
      await confirm(lastToken());
      mailer.clear();

      expect((await resend(cookie)).status).toBe(202);
      expect(mailer.sent).toEqual([]);
      expect(await prisma.accountToken.count()).toBe(0);
    });

    it('sem sessão recebe 401, e de outro site, 403', async () => {
      const cookie = await register();
      mailer.clear();

      const anonymous = await server()
        .post('/api/auth/email-confirmation/request')
        .set('Origin', origin);
      const otherSite = await server()
        .post('/api/auth/email-confirmation/request')
        .set('Origin', 'https://atacante.example')
        .set('Cookie', cookie);
      await tasks.drain();

      expect([anonymous.status, otherSite.status]).toEqual([401, 403]);
      expect(mailer.sent).toEqual([]);
    });
  });

  describe('consequências para quem não confirmou', () => {
    it('o pedido de redefinição responde igual, mas envia a confirmação no lugar do link', async () => {
      await register();
      mailer.clear();

      const response = await requestReset();

      expect(response.status).toBe(202);
      expect(response.text).toBe('');
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]).toMatchObject({
        to: EMAIL,
        subject: 'Redefinição de senha da Penumbra: confirme o seu e-mail antes',
      });
      expect(mailer.sent[0]!.text).not.toContain('/redefinir-senha#');
      expect(await prisma.accountToken.findMany({ select: { purpose: true } })).toEqual([
        { purpose: 'EMAIL_CONFIRMATION' },
      ]);
    });

    it('depois de confirmar por esse e-mail, a redefinição envia o link', async () => {
      const cookie = await register();
      await requestReset();

      expect((await confirm(lastToken())).status).toBe(204);
      mailer.clear();
      await requestReset();

      expect((await me(cookie)).emailConfirmedAt).not.toBeNull();
      expect(mailer.sent.map(({ subject }) => subject)).toEqual([
        'Redefinição de senha da Penumbra',
      ]);
      expect(mailer.sent[0]!.text).toContain(`${origin}/redefinir-senha#`);
    });

    it('o aviso de senha alterada só vai para endereço confirmado', async () => {
      await register();
      mailer.clear();
      const changer = app.get(PasswordChanger);
      const unconfirmed = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

      expect(await changer.change(unconfirmed, 'senha-nova-forte')).toBe(true);
      await tasks.drain();
      expect(mailer.sent).toEqual([]);

      const confirmed = await prisma.user.update({
        where: { email: EMAIL },
        data: { emailConfirmedAt: new Date() },
      });
      await changer.change(confirmed, 'outra-senha-forte');
      await tasks.drain();
      expect(mailer.sent.map(({ subject }) => subject)).toEqual([
        'A sua senha da Penumbra foi alterada',
      ]);
    });
  });
});
