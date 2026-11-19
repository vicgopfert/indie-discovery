import { resolve } from 'node:path';
import { z } from 'zod';

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  WEB_ORIGIN: z.url({ protocol: /^https?$/ }),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // Proxies à frente da API (Vercel e Render em produção), contados da direita do X-Forwarded-For:
  // a ponta esquerda vem do cliente e pode ser forjada, porque a Vercel nem sempre a sobrescreve.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  INTERNAL_RELOAD_SECRET: z.string().min(32),
  // console: o e-mail inteiro, com o link, vai para o terminal (desenvolvimento); off: nada é
  // enviado; resend: envio pela API HTTP do Resend (produção).
  MAIL_TRANSPORT: z.enum(['console', 'off', 'resend']).default('console'),
  RESEND_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.string().min(1).optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

// O .env fica na raiz; os scripts da API rodam em apps/api.
export const rootEnvFile = resolve(process.cwd(), '../../.env');

export function parseEnv<Schema extends z.ZodType>(
  schema: Schema,
  env: Record<string, unknown>,
): z.infer<Schema> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

// Em produção o console levaria os links de redefinição para o log da plataforma.
function checkMailTransport(env: ApiEnv, context: z.RefinementCtx) {
  if (env.NODE_ENV === 'production' && env.MAIL_TRANSPORT === 'console') {
    context.addIssue({
      code: 'custom',
      path: ['MAIL_TRANSPORT'],
      message: 'console não é permitido em produção; use off ou resend',
    });
  }
  if (env.MAIL_TRANSPORT !== 'resend') return;
  for (const name of ['RESEND_API_KEY', 'MAIL_FROM'] as const) {
    if (!env[name]) {
      context.addIssue({ code: 'custom', path: [name], message: 'obrigatória com resend' });
    }
  }
}

export function validateApiEnv(env: Record<string, unknown>): ApiEnv {
  return parseEnv(apiEnvSchema.superRefine(checkMailTransport), env);
}
