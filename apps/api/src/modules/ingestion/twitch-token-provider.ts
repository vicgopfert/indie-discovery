import { z } from 'zod';

export interface TwitchCredentials {
  clientId: string;
  clientSecret: string;
}

const RENEW_BEFORE_EXPIRY_MS = 60_000;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

export class TwitchTokenProvider {
  private token: { value: string; expiresAt: number } | undefined;
  private pending: Promise<string> | undefined;

  constructor(
    private readonly credentials: TwitchCredentials,
    private readonly tokenUrl: string,
    private readonly now: () => number = Date.now,
  ) {}

  get(): Promise<string> {
    if (this.token && this.now() < this.token.expiresAt - RENEW_BEFORE_EXPIRY_MS) {
      return Promise.resolve(this.token.value);
    }
    this.pending ??= this.request().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  invalidate(rejectedToken: string) {
    if (this.token?.value === rejectedToken) this.token = undefined;
  }

  private async request() {
    const url = new URL(this.tokenUrl);
    url.searchParams.set('client_id', this.credentials.clientId);
    url.searchParams.set('client_secret', this.credentials.clientSecret);
    url.searchParams.set('grant_type', 'client_credentials');

    const response = await fetch(url, { method: 'POST' });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Falha ao obter o token da Twitch: HTTP ${response.status}`);
    }
    const { access_token, expires_in } = tokenResponseSchema.parse(await response.json());
    this.token = { value: access_token, expiresAt: this.now() + expires_in * 1000 };
    return access_token;
  }
}
