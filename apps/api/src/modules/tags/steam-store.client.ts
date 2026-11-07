import { Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import { type RateLimit, RateLimiter } from '../ingestion/igdb/rate-limiter';

export interface SteamStoreClientOptions {
  apiUrl: string;
  rateLimit: RateLimit;
  maxAttempts: number;
  retryBaseDelayMs: number;
  requestTimeoutMs: number;
}

// A rota da loja não tem documentação pública nem limite publicado: uma requisição por segundo
// fica bem abaixo das 100 mil por dia dos termos da Web API.
export const STEAM_STORE_DEFAULTS: SteamStoreClientOptions = {
  apiUrl: 'https://api.steampowered.com',
  rateLimit: { requestsPerWindow: 1, windowMs: 1000, maxConcurrent: 1 },
  maxAttempts: 4,
  retryBaseDelayMs: 2000,
  requestTimeoutMs: 30_000,
};

export const STEAM_ITEMS_PER_REQUEST = 50;
// O máximo que a loja devolve por jogo.
export const STEAM_TAGS_PER_GAME = 20;

export type SteamLanguage = 'brazilian' | 'english';

export interface SteamTag {
  tagid: number;
  weight: number;
}

const tagListSchema = z.object({
  response: z.object({
    tags: z.array(z.object({ tagid: z.number().int(), name: z.string() })),
  }),
});

const itemsSchema = z.object({
  response: z.object({
    store_items: z
      .array(
        z.object({
          appid: z.number().int().optional(),
          success: z.number().int(),
          tags: z.array(z.object({ tagid: z.number().int(), weight: z.number() })).optional(),
        }),
      )
      .default([]),
  }),
});

export class SteamStoreError extends Error {
  constructor(
    readonly route: string,
    readonly reason: string,
  ) {
    super(`Steam ${route}: ${reason}`);
  }
}

export class SteamStoreClient {
  private readonly logger = new Logger(SteamStoreClient.name);
  private readonly options: SteamStoreClientOptions;
  private readonly limiter: RateLimiter;

  constructor(options: Partial<SteamStoreClientOptions> = {}) {
    this.options = { ...STEAM_STORE_DEFAULTS, ...options };
    this.limiter = new RateLimiter(this.options.rateLimit);
  }

  async tagNames(language: SteamLanguage): Promise<Map<number, string>> {
    const body = tagListSchema.parse(await this.get('IStoreService/GetTagList/v1/', { language }));
    return new Map(body.response.tags.map(({ tagid, name }) => [tagid, name.trim()]));
  }

  // O jogo que a loja não acha, ou que não tem etiquetas, fica fora do mapa.
  async tagsOf(appids: readonly number[]): Promise<Map<number, SteamTag[]>> {
    const tags = new Map<number, SteamTag[]>();
    for (let start = 0; start < appids.length; start += STEAM_ITEMS_PER_REQUEST) {
      const batch = appids.slice(start, start + STEAM_ITEMS_PER_REQUEST);
      const input = {
        ids: batch.map((appid) => ({ appid })),
        context: { language: 'brazilian', country_code: 'BR' },
        data_request: { include_tag_count: STEAM_TAGS_PER_GAME },
      };
      const body = itemsSchema.parse(
        await this.get('IStoreBrowseService/GetItems/v1/', { input_json: JSON.stringify(input) }),
      );
      for (const item of body.response.store_items) {
        if (item.success === 1 && item.appid !== undefined && item.tags?.length) {
          tags.set(item.appid, item.tags);
        }
      }
    }
    return tags;
  }

  private async get(route: string, params: Record<string, string>): Promise<unknown> {
    const url = `${this.options.apiUrl}/${route}?${new URLSearchParams(params).toString()}`;
    for (let attempt = 1; ; attempt++) {
      const response = await this.limiter
        .schedule(() => fetch(url, { signal: AbortSignal.timeout(this.options.requestTimeoutMs) }))
        .catch((error: unknown) => (error instanceof Error ? error : new Error(String(error))));

      if (response instanceof Response && response.ok) return response.json();

      const reason =
        response instanceof Response
          ? `HTTP ${response.status}`
          : `falha de rede (${response.message})`;
      if (response instanceof Response && !isRetryable(response.status)) {
        throw new SteamStoreError(route, reason);
      }
      if (response instanceof Response) await response.body?.cancel();
      if (attempt === this.options.maxAttempts) {
        throw new SteamStoreError(route, `${reason} após ${attempt} tentativas`);
      }
      this.logger.warn(`Steam ${route}: ${reason}, tentativa ${attempt + 1}`);
      await sleep(this.options.retryBaseDelayMs * 2 ** (attempt - 1));
    }
  }
}

function isRetryable(status: number) {
  return status === 429 || status >= 500;
}
