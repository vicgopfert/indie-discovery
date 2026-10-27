import { ConflictException, UnauthorizedException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import type { NewUser, UsersRepository } from '../users/users.repository';
import type { AuthSettings } from './auth-settings';
import { AuthService } from './auth.service';
import type { PasswordHasher } from './password-hasher';
import { hashSessionToken } from './session-token';
import type { SessionsRepository } from './sessions.repository';

const NOW = new Date('2026-10-27T12:00:00Z');

class FakeUsers implements Pick<UsersRepository, 'createIfEmailFree' | 'findByEmail'> {
  readonly saved: User[] = [];

  createIfEmailFree(data: NewUser) {
    if (this.saved.some((u) => u.email === data.email)) return Promise.resolve(null);
    const user: User = {
      id: `id-${this.saved.length + 1}`,
      ...data,
      role: 'USER',
      discoveryMode: 'BALANCED',
      onboardingCompletedAt: null,
      createdAt: NOW,
    };
    this.saved.push(user);
    return Promise.resolve(user);
  }

  findByEmail(email: string) {
    return Promise.resolve(this.saved.find((u) => u.email === email) ?? null);
  }
}

class FakeSessions implements Pick<SessionsRepository, 'create' | 'delete'> {
  readonly saved: { userId: string; tokenHash: string; expiresAt: Date }[] = [];

  create(userId: string, tokenHash: string, expiresAt: Date) {
    this.saved.push({ userId, tokenHash, expiresAt });
    return Promise.resolve();
  }

  delete(tokenHash: string) {
    this.saved.splice(
      this.saved.findIndex((s) => s.tokenHash === tokenHash),
      1,
    );
    return Promise.resolve();
  }
}

class FakeHasher implements Pick<PasswordHasher, 'hash' | 'verify'> {
  verified: string[] = [];

  hash(password: string) {
    return Promise.resolve(`hash(${password})`);
  }

  verify(hash: string, password: string) {
    this.verified.push(hash);
    return Promise.resolve(hash === `hash(${password})`);
  }
}

const settings: AuthSettings = { sessionTtlDays: 7, secureCookie: false };

describe('AuthService', () => {
  let users: FakeUsers;
  let sessions: FakeSessions;
  let hasher: FakeHasher;
  let auth: AuthService;
  const input = { email: 'jogadora@example.com', displayName: 'Jogadora', password: 'senha-forte' };

  beforeEach(() => {
    users = new FakeUsers();
    sessions = new FakeSessions();
    hasher = new FakeHasher();
    auth = new AuthService(
      users as unknown as UsersRepository,
      sessions as unknown as SessionsRepository,
      hasher,
      settings,
    );
  });

  describe('register', () => {
    it('guarda o hash da senha, nunca a senha', async () => {
      await auth.register(input, NOW);

      expect(users.saved[0]?.passwordHash).toBe('hash(senha-forte)');
    });

    it('devolve o usuário sem o hash da senha e já abre a sessão', async () => {
      const { user, token } = await auth.register(input, NOW);

      expect(user).toEqual({
        id: 'id-1',
        email: 'jogadora@example.com',
        displayName: 'Jogadora',
        role: 'USER',
        discoveryMode: 'BALANCED',
        onboardingCompletedAt: null,
        createdAt: '2026-10-27T12:00:00.000Z',
      });
      expect(JSON.stringify(user)).not.toContain('senha-forte');
      expect(sessions.saved).toEqual([
        {
          userId: 'id-1',
          tokenHash: hashSessionToken(token),
          expiresAt: new Date('2026-11-03T12:00:00Z'),
        },
      ]);
    });

    it('recusa o e-mail já cadastrado com 409', async () => {
      await auth.register(input, NOW);

      await expect(auth.register({ ...input, displayName: 'Outra' }, NOW)).rejects.toThrow(
        ConflictException,
      );
      expect(users.saved).toHaveLength(1);
    });
  });

  describe('login', () => {
    beforeEach(() => auth.register(input, NOW));

    it('abre uma sessão nova e guarda só o hash do token', async () => {
      const { token } = await auth.login({ email: input.email, password: 'senha-forte' }, NOW);

      expect(sessions.saved).toHaveLength(2);
      expect(sessions.saved[1]?.tokenHash).toBe(hashSessionToken(token));
      expect(sessions.saved[1]?.tokenHash).not.toBe(token);
    });

    it.each([
      ['senha errada', { email: input.email, password: 'outra-senha' }],
      ['e-mail sem conta', { email: 'ninguem@example.com', password: 'senha-forte' }],
    ])('recusa %s com a mesma mensagem genérica', async (_, credentials) => {
      await expect(auth.login(credentials, NOW)).rejects.toThrow(
        new UnauthorizedException('E-mail ou senha incorretos'),
      );
      expect(sessions.saved).toHaveLength(1);
    });

    it('verifica uma senha mesmo quando o e-mail não tem conta', async () => {
      hasher.verified = [];

      await expect(
        auth.login({ email: 'ninguem@example.com', password: 'qualquer' }, NOW),
      ).rejects.toThrow(UnauthorizedException);
      expect(hasher.verified).toHaveLength(1);
    });
  });

  it('logout apaga a sessão do token', async () => {
    const { token } = await auth.register(input, NOW);

    await auth.logout(token);

    expect(sessions.saved).toEqual([]);
  });
});
