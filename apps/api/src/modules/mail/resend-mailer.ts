import type { Email, Mailer } from './mailer';

export const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 10_000;

export interface ResendSettings {
  apiKey: string;
  from: string;
}

// O status vai no código, que é o que o log de falha registra.
export class ResendRejectedError extends Error {
  override readonly name = 'ResendRejectedError';
  readonly code: string;

  constructor(status: number) {
    super(`O Resend recusou o envio com o status ${status}`);
    this.code = `HTTP_${status}`;
  }
}

// API HTTP, porque o plano gratuito do Render bloqueia as portas SMTP.
export class ResendMailer implements Mailer {
  constructor(
    private readonly settings: ResendSettings,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async send({ to, subject, text }: Email) {
    const response = await this.fetchFn(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: this.settings.from, to: [to], subject, text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // O corpo da resposta fica fora do erro: ele pode repetir o destinatário.
    if (!response.ok) throw new ResendRejectedError(response.status);
  }
}
