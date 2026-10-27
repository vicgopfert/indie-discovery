import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { LoginInput, RegisterInput } from '@indie/contracts';
import type { User } from '../../generated/prisma/client';
import { toPublicUser } from '../users/user.presenter';
import { UsersRepository } from '../users/users.repository';
import { AUTH_SETTINGS, type AuthSettings, sessionExpiresAt } from './auth-settings';
import { PasswordHasher } from './password-hasher';
import { hashSessionToken, newSessionToken } from './session-token';
import { SessionsRepository } from './sessions.repository';

const WRONG_CREDENTIALS = 'E-mail ou senha incorretos';

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly passwords: PasswordHasher,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  // O e-mail chega normalizado pelo schema de entrada. O cadastro já abre a sessão.
  async register({ email, displayName, password }: RegisterInput, now = new Date()) {
    const user = await this.users.createIfEmailFree({
      email,
      displayName,
      passwordHash: await this.passwords.hash(password),
    });
    if (!user) throw new ConflictException('E-mail já cadastrado');
    return this.startSession(user, now);
  }

  async login({ email, password }: LoginInput, now = new Date()) {
    const user = await this.users.findByEmail(email);
    if (!user) {
      await this.spendPasswordCheck(password);
      throw new UnauthorizedException(WRONG_CREDENTIALS);
    }
    if (!(await this.passwords.verify(user.passwordHash, password))) {
      throw new UnauthorizedException(WRONG_CREDENTIALS);
    }
    return this.startSession(user, now);
  }

  async logout(token: string) {
    await this.sessions.delete(hashSessionToken(token));
  }

  private async startSession(user: User, now: Date) {
    const token = newSessionToken();
    await this.sessions.create(
      user.id,
      hashSessionToken(token),
      sessionExpiresAt(this.settings, now),
    );
    return { user: toPublicUser(user), token };
  }

  // Sem conta, a senha é verificada contra um hash qualquer: o tempo de resposta não revela se o
  // e-mail está cadastrado.
  private async spendPasswordCheck(password: string) {
    this.dummyHash ??= this.passwords.hash('senha-de-uma-conta-que-nao-existe');
    await this.passwords.verify(await this.dummyHash, password);
  }
}
