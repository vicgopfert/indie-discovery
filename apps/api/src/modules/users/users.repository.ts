import { Injectable } from '@nestjs/common';
import {
  AccountTokenPurpose,
  type DiscoveryMode,
  Prisma,
  type User,
} from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface NewUser {
  email: string;
  passwordHash: string;
  displayName: string;
}

const UNIQUE_VIOLATION = 'P2002';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  // O índice único do e-mail decide a corrida entre dois cadastros simultâneos: null se já existe.
  async createIfEmailFree(data: NewUser): Promise<User | null> {
    try {
      return await this.prisma.user.create({ data });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === UNIQUE_VIOLATION
      ) {
        return null;
      }
      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  // Numa transação: consome o token de redefinição, se houver, grava o hash novo e encerra as
  // sessões e os links de redefinição pendentes. false se outro pedido já usou o token.
  replacePassword(userId: string, passwordHash: string, consumedTokenId?: string) {
    return this.prisma.$transaction(async (tx) => {
      if (consumedTokenId) {
        const { count } = await tx.accountToken.deleteMany({ where: { id: consumedTokenId } });
        if (count === 0) return false;
      }
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.accountToken.deleteMany({
        where: { userId, purpose: AccountTokenPurpose.PASSWORD_RESET },
      });
      return true;
    });
  }

  // Numa transação: consome o token de confirmação e grava a data, mantendo a primeira se o
  // e-mail já estava confirmado. false se outro pedido já usou o token.
  confirmEmail(userId: string, consumedTokenId: string, now: Date) {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.accountToken.deleteMany({ where: { id: consumedTokenId } });
      if (count === 0) return false;
      await tx.user.updateMany({
        where: { id: userId, emailConfirmedAt: null },
        data: { emailConfirmedAt: now },
      });
      return true;
    });
  }

  updateDiscoveryMode(id: string, discoveryMode: DiscoveryMode): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { discoveryMode } });
  }
}
