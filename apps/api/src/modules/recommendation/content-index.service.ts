import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { TagVocabulary } from '../tags/tags';
import { buildContentIndex, type ContentIndex } from './content-index';
import { ContentIndexRepository } from './content-index.repository';
import type { TfidfConfig } from './tfidf';

export const TFIDF_CONFIG = Symbol('TFIDF_CONFIG');
export const TAG_VOCABULARY = Symbol('TAG_VOCABULARY');

export interface LoadedIndex {
  index: ContentIndex;
  loadedAt: Date;
  durationMs: number;
}

export type ContentIndexStatus =
  { status: 'ready'; games: number; loadedAt: Date } | { status: 'loading' } | { status: 'failed' };

const MB = 1024 * 1024;

// Na inicialização, a carga que falha (o Neon acordando, a CPU de 0,1 núcleo da instância gratuita)
// é tentada de novo depois de 10 s e de 30 s. Sem índice, o health continua em failed.
export const BOOT_RETRY_DELAYS_MS = [10_000, 30_000];

@Injectable()
export class ContentIndexService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(ContentIndexService.name);
  private current: LoadedIndex | null = null;
  private pending: Promise<LoadedIndex> | null = null;
  private failed = false;
  private closing = false;
  private cancelRetry: (() => void) | null = null;
  private readonly shelfTagIds: ReadonlySet<number>;

  constructor(
    private readonly repository: ContentIndexRepository,
    @Inject(TFIDF_CONFIG) private readonly config: TfidfConfig,
    @Inject(TAG_VOCABULARY) vocabulary: TagVocabulary,
  ) {
    this.shelfTagIds = new Set(
      vocabulary.tags.filter((t) => t.accepted && t.shelf).map((t) => t.id),
    );
  }

  // A carga roda depois que a API começa a escutar: o health check do Render responde em até
  // 5 s mesmo com o banco lento, e uma falha deixa a API no ar com o índice em "failed".
  onApplicationBootstrap() {
    void this.loadAtBoot();
  }

  onModuleDestroy() {
    this.closing = true;
    this.cancelRetry?.();
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

  private async loadAtBoot() {
    const attempts = BOOT_RETRY_DELAYS_MS.length + 1;
    for (let attempt = 1; attempt <= attempts && !this.closing; attempt++) {
      try {
        await this.reload();
        if (attempt > 1) this.logger.log(`Índice carregado na tentativa ${attempt} de ${attempts}`);
        return;
      } catch {
        const delay = BOOT_RETRY_DELAYS_MS[attempt - 1];
        if (delay === undefined) {
          this.logger.error(
            `As ${attempts} tentativas de carga falharam; sem índice até a próxima recarga`,
          );
          return;
        }
        this.logger.warn(
          `Tentativa ${attempt} de ${attempts} da carga falhou; nova tentativa em ${delay / 1000} s`,
        );
        await this.wait(delay);
      }
    }
  }

  private wait(ms: number) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.cancelRetry = () => {
        clearTimeout(timer);
        resolve();
      };
    }).finally(() => {
      this.cancelRetry = null;
    });
  }

  private async load(): Promise<LoadedIndex> {
    const start = Date.now();
    const before = process.memoryUsage();
    try {
      const rows = await this.repository.loadRows();
      const transactionMs = Date.now() - start;
      const index = buildContentIndex(rows, this.config, this.shelfTagIds);
      const after = process.memoryUsage();
      this.current = { index, loadedAt: new Date(), durationMs: Date.now() - start };
      this.failed = false;
      this.logger.log(
        `Índice de conteúdo carregado: ${index.games.length} jogos, ` +
          `${index.features.length} atributos, ` +
          `${this.current.durationMs} ms (transação ${transactionMs} ms, ` +
          `montagem ${this.current.durationMs - transactionMs} ms); ` +
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
