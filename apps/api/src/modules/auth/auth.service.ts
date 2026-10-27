import { ConflictException, Injectable } from '@nestjs/common';
import type { RegisterInput } from '@indie/contracts';
import { toPublicUser } from '../users/user.presenter';
import { UsersRepository } from '../users/users.repository';
import { PasswordHasher } from './password-hasher';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly passwords: PasswordHasher,
  ) {}

  // O e-mail chega normalizado pelo schema de entrada.
  async register({ email, displayName, password }: RegisterInput) {
    const user = await this.users.createIfEmailFree({
      email,
      displayName,
      passwordHash: await this.passwords.hash(password),
    });
    if (!user) throw new ConflictException('E-mail já cadastrado');
    return toPublicUser(user);
  }
}
