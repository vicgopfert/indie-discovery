import { resolve } from 'node:path';
import { z } from 'zod';

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  WEB_ORIGIN: z.url({ protocol: /^https?$/ }),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  INTERNAL_RELOAD_SECRET: z.string().min(32),
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

export function validateApiEnv(env: Record<string, unknown>): ApiEnv {
  return parseEnv(apiEnvSchema, env);
}
