import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentIndexService } from '../recommendation/content-index.service';

export type ContentIndexHealth =
  { status: 'ready'; games: number; loadedAt: string } | { status: 'loading' | 'failed' };

export interface HealthReport {
  status: 'ok' | 'degraded';
  database: 'up' | 'down';
  contentIndex: ContentIndexHealth;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentIndex: ContentIndexService,
  ) {}

  // "degraded" ainda responde 200: o health check do Render aceita qualquer 2xx ou 3xx, e a API
  // continua servindo catálogo e contas sem o banco de pé ou sem o índice de conteúdo.
  async check(): Promise<HealthReport> {
    const database = await this.database();
    const index = this.contentIndex.status();
    const contentIndex: ContentIndexHealth =
      index.status === 'ready'
        ? { status: 'ready', games: index.games, loadedAt: index.loadedAt.toISOString() }
        : index;
    const ok = database === 'up' && contentIndex.status === 'ready';
    return { status: ok ? 'ok' : 'degraded', database, contentIndex };
  }

  private async database(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
