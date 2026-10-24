import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const ratio = z.number().positive().max(1);

export const ingestionConfigSchema = z.object({
  candidateFilter: z.string().min(1),
  candidateFilterRationale: z.string().min(1),
  maxInvalidRatio: ratio,
  maxInvalidRatioRationale: z.string().min(1),
  minFetchedRatioToDeactivate: ratio,
  minFetchedRatioRationale: z.string().min(1),
});

export type IngestionConfig = z.infer<typeof ingestionConfigSchema>;

export const INGESTION_CONFIG_FILE = resolve(process.cwd(), 'config/ingestion.json');

export function readIngestionConfig(file = INGESTION_CONFIG_FILE): IngestionConfig {
  return ingestionConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}
