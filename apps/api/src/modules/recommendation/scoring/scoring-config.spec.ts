import { readScoringConfig, scoringConfigSchema } from './scoring-config';

describe('readScoringConfig', () => {
  it('lê e valida o arquivo versionado, com os valores iniciais da proposta', () => {
    expect(readScoringConfig()).toMatchObject({
      listBonus: { FAVORITE: 2, COMPLETED: 1, WANT_TO_PLAY: 0.5 },
      preferenceWeight: 1,
      popularityWeightByMode: { POPULAR: -0.2, BALANCED: 0, DISCOVERY: 0.3 },
      lists: {
        maxInterests: 4,
        interestMaxDocumentRatio: 0.4,
        shelfMinItems: 4,
        overviewMainSize: 20,
        overviewShelfSize: 10,
        pageSize: 20,
        mainCap: 100,
        shelfCap: 200,
      },
    });
  });

  it('recusa tamanhos de lista incoerentes', () => {
    const config = readScoringConfig();
    const withLists = (lists: Partial<typeof config.lists>) =>
      scoringConfigSchema.safeParse({ ...config, lists: { ...config.lists, ...lists } }).success;

    expect(withLists({})).toBe(true);
    expect(withLists({ mainCap: 201 })).toBe(false);
    expect(withLists({ overviewMainSize: 101 })).toBe(false);
    expect(withLists({ shelfMinItems: 11 })).toBe(false);
    expect(withLists({ maxInterests: 0 })).toBe(false);
    expect(withLists({ pageSize: 2.5 })).toBe(false);
    expect(withLists({ interestMaxDocumentRatio: 0 })).toBe(false);
    expect(withLists({ interestMaxDocumentRatio: 1.2 })).toBe(false);
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
