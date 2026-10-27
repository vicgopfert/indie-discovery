import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indieCriteriaSchema, readVersionedIndieCriteria } from './indie-criteria.config';

describe('validação do arquivo de critério', () => {
  const raw = JSON.parse(readFileSync('config/indie-criteria.json', 'utf8')) as Record<
    string,
    unknown
  > & {
    overrides: { alwaysInclude: Record<string, unknown>[]; alwaysExclude: unknown[] };
    overridesPolicy: { maxEntries: number };
    majorCompanies: Record<string, unknown>[];
    controlledStudios: Record<string, unknown>[];
  };
  const [firstOverride] = raw.overrides.alwaysInclude;
  const [firstStudio] = raw.controlledStudios;

  it('exige fonte pública e data em cada exceção', () => {
    const withoutSource = { ...firstOverride, source: undefined };

    expect(() =>
      indieCriteriaSchema.parse({
        ...raw,
        overrides: { ...raw.overrides, alwaysInclude: [withoutSource] },
      }),
    ).toThrow('source');
  });

  it('recusa listas de exceção que passam do teto de entradas', () => {
    const tooMany = Array.from({ length: raw.overridesPolicy.maxEntries + 1 }, (_, i) => ({
      ...firstOverride,
      igdbId: i + 1,
    }));

    expect(() =>
      indieCriteriaSchema.parse({
        ...raw,
        overrides: { ...raw.overrides, alwaysInclude: tooMany },
      }),
    ).toThrow('o problema é a regra');
  });

  it('exige que a dona do estúdio controlado esteja na lista de grandes', () => {
    const orphan = { ...firstStudio, ownerIgdbId: 999999999 };

    expect(() => indieCriteriaSchema.parse({ ...raw, controlledStudios: [orphan] })).toThrow(
      'lista de grandes',
    );
  });

  it('exige que a saída do grupo seja posterior à aquisição', () => {
    const inverted = { ...firstStudio, acquiredAt: '2020-01-01', divestedAt: '2019-01-01' };

    expect(() => indieCriteriaSchema.parse({ ...raw, controlledStudios: [inverted] })).toThrow(
      'posterior à aquisição',
    );
  });

  it('exige o ramo do teste de entrada em cada grande empresa', () => {
    const [firstMajor] = raw.majorCompanies;
    const withoutVia = { ...firstMajor, via: undefined };

    expect(() => indieCriteriaSchema.parse({ ...raw, majorCompanies: [withoutVia] })).toThrow(
      'via',
    );
  });

  it('recusa empresa ou estúdio repetido pelo id da IGDB', () => {
    const [firstMajor] = raw.majorCompanies;

    expect(() =>
      indieCriteriaSchema.parse({ ...raw, majorCompanies: [...raw.majorCompanies, firstMajor] }),
    ).toThrow('repetida');
    expect(() =>
      indieCriteriaSchema.parse({
        ...raw,
        controlledStudios: [...raw.controlledStudios, firstStudio],
      }),
    ).toThrow('repetido');
  });

  it('versiona o critério pelo conteúdo do arquivo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'criteria-'));
    const copy = join(dir, 'indie-criteria.json');
    writeFileSync(copy, JSON.stringify(raw));
    const first = readVersionedIndieCriteria(copy).version;
    writeFileSync(copy, JSON.stringify({ ...raw, principle: 'outro princípio' }));

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(readVersionedIndieCriteria(copy).version).not.toBe(first);
  });

  it('exige fonte pública em cada estúdio controlado', () => {
    const withoutSource = { ...firstStudio, source: 'não é url' };

    expect(() => indieCriteriaSchema.parse({ ...raw, controlledStudios: [withoutSource] })).toThrow(
      'source',
    );
  });
});
