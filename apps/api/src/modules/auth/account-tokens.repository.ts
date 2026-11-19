import { Inject, Injectable } from '@nestjs/common';
import type { AccountTokenPurpose } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AccountTokensRepository {
  // Injeção explícita, como no SessionsRepository: a ingestão também limpa os tokens vencidos.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // A restrição única por usuário e finalidade deixa um só token ativo: o novo substitui o anterior,
  // mesmo com dois pedidos ao mesmo tempo.
  async replace(userId: string, purpose: AccountTokenPurpose, tokenHash: string, expiresAt: Date) {
    await this.prisma.accountToken.upsert({
      where: { userId_purpose: { userId, purpose } },
      create: { userId, purpose, tokenHash, expiresAt },
      update: { tokenHash, expiresAt, createdAt: new Date() },
    });
  }

  findValid(tokenHash: string, purpose: AccountTokenPurpose, now: Date) {
    return this.prisma.accountToken.findFirst({
      where: { tokenHash, purpose, expiresAt: { gt: now } },
      include: { user: true },
    });
  }

  async deleteExpired(now: Date) {
    const { count } = await this.prisma.accountToken.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    return count;
  }
}
