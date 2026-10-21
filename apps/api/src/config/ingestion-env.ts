import { z } from 'zod';
import { apiEnvSchema, parseEnv } from './env';

export const ingestionEnvSchema = apiEnvSchema.pick({ NODE_ENV: true, DATABASE_URL: true }).extend({
  IGDB_CLIENT_ID: z.string().min(1),
  IGDB_CLIENT_SECRET: z.string().min(1),
});

export type IngestionEnv = z.infer<typeof ingestionEnvSchema>;

export function validateIngestionEnv(env: Record<string, unknown>): IngestionEnv {
  return parseEnv(ingestionEnvSchema, env);
}
