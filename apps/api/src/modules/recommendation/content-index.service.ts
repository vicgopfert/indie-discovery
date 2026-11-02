import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { buildContentIndex, type ContentIndex } from './content-index';
import { ContentIndexRepository } from './content-index.repository';
import type { TfidfConfig } from './tfidf';

export const TFIDF_CONFIG = Symbol('TFIDF_CONFIG');

export interface LoadedIndex {
  index: ContentIndex;
  loadedAt: Date;
  durationMs: number;
}

export type ContentIndexStatus =
  { status: 'ready'; games: number; loadedAt: Date } | { status: 'loading' } | { status: 'failed' };

const MB = 1024 * 1024;

@Injectable()
export class ContentIndexService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ContentIndexService.name);
  private current: LoadedIndex | null = null;
  private pending: Promise<LoadedIndex> | null = null;
  private failed = false;

  constructor(
    private readonly repository: ContentIndexRepository,
    @Inject(TFIDF_CONFIG) private readonly config: TfidfConfig,
  ) {}

  // A carga roda depois que a API começa a escutar: o health check do Render responde em até
  // 5 s mesmo com o banco lento, e uma falha deixa a API no ar com o índice em "failed".
  onApplicationBootstrap() {
    this.reload().catch(() => undefined);
  }

  onModuleDestroy() {
    return this.settled();
  }

  // Espera a carga em andamento, se houver, sem disparar outra e sem propagar a falha.
  async settled(): Promise<void> {
    await this.pending?.catch(() => undefined);
  }

  get index(): ContentIndex | null {
    return this.current?.index ?? null;
  }

  status(): ContentIndexStatus {
    if (this.current) {
      return {
        status: 'ready',
        games: this.current.index.games.length,
        loadedAt: this.current.loadedAt,
      };
    }
    return this.failed ? { status: 'failed' } : { status: 'loading' };
  }

  // O índice novo só substitui o anterior depois de pronto; se a carga falha, o anterior continua.
  // Recargas simultâneas compartilham a mesma execução.
  reload(): Promise<LoadedIndex> {
    this.pending ??= this.load().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }

  private async load(): Promise<LoadedIndex> {
    const start = Date.now();
    const before = process.memoryUsage();
    try {
      const index = buildContentIndex(await this.repository.loadRows(), this.config);
      const after = process.memoryUsage();
      this.current = { index, loadedAt: new Date(), durationMs: Date.now() - start };
      this.failed = false;
      this.logger.log(
        `Índice de conteúdo carregado: ${index.games.length} jogos, ` +
          `${index.features.length} atributos, ${this.current.durationMs} ms; ` +
          `heap ${(after.heapUsed / MB).toFixed(1)} MB (${signedMb(after.heapUsed - before.heapUsed)}), ` +
          `RSS ${(after.rss / MB).toFixed(1)} MB (${signedMb(after.rss - before.rss)})`,
      );
      return this.current;
    } catch (error) {
      this.failed = this.current === null;
      this.logger.error(
        'Falha ao carregar o índice de conteúdo',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}

function signedMb(bytes: number) {
  return `${bytes >= 0 ? '+' : ''}${(bytes / MB).toFixed(1)} MB`;
}
