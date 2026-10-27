import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, tokenHash: string, expiresAt: Date) {
    await this.prisma.session.create({ data: { userId, tokenHash, expiresAt } });
  }

  async findUserOfValidSession(tokenHash: string, now: Date) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    return session && session.expiresAt > now ? session.user : null;
  }

  async delete(tokenHash: string) {
    await this.prisma.session.deleteMany({ where: { tokenHash } });
  }

  async deleteExpired(now: Date) {
    const { count } = await this.prisma.session.deleteMany({ where: { expiresAt: { lte: now } } });
    return count;
  }
}
