import { Injectable } from '@nestjs/common';
import { Prisma, type User } from '../../generated/prisma/client';
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
}
