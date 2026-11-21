import { Inject, Injectable } from '@nestjs/common';
import { BackgroundTasks } from '../../common/background-tasks';
import type { User } from '../../generated/prisma/client';
import { MAILER, type Mailer } from '../mail/mailer';
import { UsersRepository } from '../users/users.repository';
import { passwordChangedEmail } from './account-emails';
import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { PasswordHasher } from './password-hasher';

// Grava a senha nova, encerra todas as sessões e avisa por e-mail, se o endereço estiver
// confirmado. Serve à redefinição e à troca de senha com a conta aberta.
@Injectable()
export class PasswordChanger {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordHasher,
    private readonly tasks: BackgroundTasks,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
  ) {}

  async change(user: User, password: string, consumedTokenId?: string, now = new Date()) {
    const passwordHash = await this.passwords.hash(password);
    const changed = await this.users.replacePassword(user.id, passwordHash, consumedTokenId);
    if (changed && user.emailConfirmedAt) {
      const email = passwordChangedEmail(user.email, now, this.settings.webOrigin);
      this.tasks.run('aviso de senha alterada', () => this.mailer.send(email));
    }
    return changed;
  }
}
