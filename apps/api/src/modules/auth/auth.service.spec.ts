import { ConflictException } from '@nestjs/common';
import type { User } from '../../generated/prisma/client';
import type { NewUser, UsersRepository } from '../users/users.repository';
import { AuthService } from './auth.service';
import type { PasswordHasher } from './password-hasher';

class FakeUsers implements Pick<UsersRepository, 'createIfEmailFree'> {
  readonly saved: User[] = [];

  createIfEmailFree(data: NewUser) {
    if (this.saved.some((u) => u.email === data.email)) return Promise.resolve(null);
    const user: User = {
      id: `id-${this.saved.length + 1}`,
      ...data,
      role: 'USER',
      discoveryMode: 'BALANCED',
      onboardingCompletedAt: null,
      createdAt: new Date('2026-10-27T12:00:00Z'),
    };
    this.saved.push(user);
    return Promise.resolve(user);
  }
}

const fakeHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hash(${password})`),
  verify: (hash, password) => Promise.resolve(hash === `hash(${password})`),
};

describe('AuthService.register', () => {
  let users: FakeUsers;
  let auth: AuthService;
  const input = { email: 'jogadora@example.com', displayName: 'Jogadora', password: 'senha-forte' };

  beforeEach(() => {
    users = new FakeUsers();
    auth = new AuthService(users as unknown as UsersRepository, fakeHasher);
  });

  it('guarda o hash da senha, nunca a senha', async () => {
    await auth.register(input);

    expect(users.saved[0]?.passwordHash).toBe('hash(senha-forte)');
  });

  it('devolve o usuário sem o hash da senha', async () => {
    const user = await auth.register(input);

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
  });

  it('recusa o e-mail já cadastrado com 409', async () => {
    await auth.register(input);

    await expect(auth.register({ ...input, displayName: 'Outra' })).rejects.toThrow(
      ConflictException,
    );
    expect(users.saved).toHaveLength(1);
  });
});
