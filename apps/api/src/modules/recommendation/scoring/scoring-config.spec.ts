import { readScoringConfig, scoringConfigSchema } from './scoring-config';

describe('readScoringConfig', () => {
  it('lê e valida o arquivo versionado, com os valores iniciais da proposta', () => {
    expect(readScoringConfig()).toMatchObject({
      listBonus: { FAVORITE: 2, COMPLETED: 1, WANT_TO_PLAY: 0.5 },
      preferenceWeight: 1,
      popularityWeightByMode: { POPULAR: -0.2, BALANCED: 0, DISCOVERY: 0.3 },
    });
  });

  it('recusa bônus de lista negativo e modo sem λ', () => {
    const config = readScoringConfig();
    expect(() =>
      scoringConfigSchema.parse({ ...config, listBonus: { ...config.listBonus, FAVORITE: -1 } }),
    ).toThrow();
    expect(() =>
      scoringConfigSchema.parse({ ...config, popularityWeightByMode: { POPULAR: -0.2 } }),
    ).toThrow();
  });
});
