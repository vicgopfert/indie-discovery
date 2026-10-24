import { canDeactivateMissing, missingCause } from './candidate-set';

const INDIE = 32;

describe('canDeactivateMissing', () => {
  it.each<[number, number | null, boolean]>([
    [1000, null, true],
    [960, 1000, true],
    [949, 1000, false],
  ])('busca de %s contra %s da execução anterior → desativa: %s', (fetched, previous, allowed) => {
    expect(canDeactivateMissing(fetched, previous, 0.95)).toBe(allowed);
  });
});

describe('missingCause', () => {
  it('separa o jogo que perdeu o gênero Indie do que sumiu da IGDB', () => {
    expect(missingCause({ genres: [5, 31] }, INDIE)).toBe('LOST_INDIE_GENRE');
    expect(missingCause(undefined, INDIE)).toBe('NOT_FOUND');
    expect(missingCause({ genres: [INDIE] }, INDIE)).toBe('OUT_OF_SCOPE');
  });
});
