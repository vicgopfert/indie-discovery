import { Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { RateLimiter, type RateLimit } from './rate-limiter';
import { TwitchTokenProvider, type TwitchCredentials } from './twitch-token-provider';

export interface IgdbClientOptions {
  credentials: TwitchCredentials;
  apiUrl: string;
  tokenUrl: string;
  rateLimit: RateLimit;
  maxAttempts: number;
  retryBaseDelayMs: number;
  requestTimeoutMs: number;
}

// Limites confirmados no M0: 4 requisições por segundo e até 8 abertas ao mesmo tempo.
export const IGDB_DEFAULTS: Omit<IgdbClientOptions, 'credentials'> = {
  apiUrl: 'https://api.igdb.com/v4',
  tokenUrl: 'https://id.twitch.tv/oauth2/token',
  rateLimit: { requestsPerWindow: 4, windowMs: 1000, maxConcurrent: 8 },
  maxAttempts: 5,
  retryBaseDelayMs: 1000,
  requestTimeoutMs: 30_000,
};

export const IGDB_MAX_PAGE_SIZE = 500;

const igdbPageSchema = z.array(z.looseObject({ id: z.number().int() }));

export type IgdbRecord = z.infer<typeof igdbPageSchema>[number];

export interface IgdbPageQuery {
  fields: string;
  where?: string;
  pageSize?: number;
}

export class IgdbRequestError extends Error {
  constructor(
    readonly endpoint: string,
    readonly reason: string,
  ) {
    super(`IGDB ${endpoint}: ${reason}`);
  }
}

export class IgdbClient {
  private readonly logger = new Logger(IgdbClient.name);
  private readonly options: IgdbClientOptions;
  private readonly tokens: TwitchTokenProvider;
  private readonly limiter: RateLimiter;

  constructor(options: Partial<IgdbClientOptions> & Pick<IgdbClientOptions, 'credentials'>) {
    this.options = { ...IGDB_DEFAULTS, ...options };
    this.tokens = new TwitchTokenProvider(this.options.credentials, this.options.tokenUrl);
    this.limiter = new RateLimiter(this.options.rateLimit);
  }

  async query(endpoint: string, body: string): Promise<unknown> {
    for (let attempt = 1; ; attempt++) {
      const token = await this.tokens.get();
      const response = await this.limiter
        .schedule(() => this.post(endpoint, body, token))
        .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

      if (response instanceof Response && response.ok) return response.json();

      const reason =
        response instanceof Response
          ? `HTTP ${response.status}`
          : `falha de rede (${response.message})`;
      if (response instanceof Response && !isRetryable(response.status)) {
        throw new IgdbRequestError(endpoint, `${reason}: ${await response.text()}`);
      }
      if (response instanceof Response) await response.body?.cancel();
      if (attempt === this.options.maxAttempts) {
        throw new IgdbRequestError(endpoint, `${reason} após ${attempt} tentativas`);
      }

      this.logger.warn(
        `IGDB ${endpoint}: ${reason}, tentativa ${attempt + 1} de ${this.options.maxAttempts}`,
      );
      if (response instanceof Response && response.status === 401) {
        this.tokens.invalidate(token);
      } else {
        await sleep(this.options.retryBaseDelayMs * 2 ** (attempt - 1));
      }
    }
  }

  async *paginate(endpoint: string, query: IgdbPageQuery): AsyncGenerator<IgdbRecord[]> {
    const pageSize = Math.min(query.pageSize ?? IGDB_MAX_PAGE_SIZE, IGDB_MAX_PAGE_SIZE);
    let lastId = 0;
    for (;;) {
      const where = query.where ? `(${query.where}) & id > ${lastId}` : `id > ${lastId}`;
      const page = igdbPageSchema.parse(
        await this.query(
          endpoint,
          `fields ${query.fields}; where ${where}; sort id asc; limit ${pageSize};`,
        ),
      );
      if (page.length > 0) yield page;
      if (page.length < pageSize) return;
      lastId = page[page.length - 1]!.id;
    }
  }

  private post(endpoint: string, body: string, token: string) {
    return fetch(`${this.options.apiUrl}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': this.options.credentials.clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(this.options.requestTimeoutMs),
    });
  }
}

function isRetryable(status: number) {
  return status === 401 || status === 429 || status >= 500;
}
