import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export const RECOMMENDATION_CONFIG_FILE = resolve(process.cwd(), 'config/recommendation.json');

// O arquivo tem um bloco para o TF-IDF, usado pela ingestão e pelo índice, e um para a pontuação.
export function readRecommendationConfig<Schema extends z.ZodType>(
  section: 'tfidf' | 'scoring',
  schema: Schema,
  file = RECOMMENDATION_CONFIG_FILE,
): z.infer<Schema> {
  const parsed = z.object({ [section]: schema }).parse(JSON.parse(readFileSync(file, 'utf8')));
  return parsed[section] as z.infer<Schema>;
}
