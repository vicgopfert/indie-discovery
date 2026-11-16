import { readFileSync } from 'node:fs';
import {
  EVALUATION_CONFIG_FILE,
  evaluationConfigSchema,
  readEvaluationConfig,
} from './evaluation-config';

describe('configuração da avaliação offline', () => {
  it('o arquivo versionado é válido, com os dois cortes do plano', () => {
    const config = readEvaluationConfig();

    expect(config.cutoffs).toEqual([10, 20]);
    expect(config.bootstrap.confidence).toBe(0.95);
  });

  it('recusa nota baixa entre os jogos bem avaliados e λ do Populares positivo', () => {
    const raw = JSON.parse(readFileSync(EVALUATION_CONFIG_FILE, 'utf8')) as Record<
      string,
      Record<string, unknown>
    >;

    expect(
      evaluationConfigSchema.safeParse({
        ...raw,
        attributeProfiles: { ...raw.attributeProfiles, positiveScores: [5, 3] },
      }).success,
    ).toBe(false);
    expect(
      evaluationConfigSchema.safeParse({
        ...raw,
        variants: { ...raw.variants, popularLambda: [0.1] },
      }).success,
    ).toBe(false);
  });
});
