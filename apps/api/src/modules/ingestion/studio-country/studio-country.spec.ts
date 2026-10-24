import { StudioCountrySource } from '../../../generated/prisma/client';
import { resolveStudioCountry, type WikidataCountries } from './studio-country';

const BRAZIL = 76;
const CANADA = 124;
const USA = 840;

const wikidata = (developer: number[], origin: number[] = []): WikidataCountries => ({
  developer: new Set(developer),
  origin: new Set(origin),
});

describe('resolveStudioCountry', () => {
  it('fica com o país da IGDB quando ela informa, mesmo que o Wikidata diga outro', () => {
    expect(resolveStudioCountry(USA, wikidata([CANADA]))).toEqual({
      code: USA,
      source: StudioCountrySource.IGDB,
    });
  });

  it('usa o país da desenvolvedora no Wikidata quando falta o da IGDB', () => {
    expect(resolveStudioCountry(null, wikidata([BRAZIL], [USA]))).toEqual({
      code: BRAZIL,
      source: StudioCountrySource.WIKIDATA,
    });
  });

  it('usa o país de origem do jogo só quando o Wikidata não tem desenvolvedora com país', () => {
    expect(resolveStudioCountry(null, wikidata([], [BRAZIL]))).toEqual({
      code: BRAZIL,
      source: StudioCountrySource.WIKIDATA,
    });
  });

  it.each([
    ['duas desenvolvedoras de países diferentes', wikidata([USA, CANADA], [USA])],
    ['dois países de origem', wikidata([], [USA, CANADA])],
  ])('deixa sem país o caso ambíguo: %s', (_, countries) => {
    expect(resolveStudioCountry(null, countries)).toEqual({ code: null, source: null });
  });

  it('deixa sem país o jogo que nenhuma fonte informa', () => {
    expect(resolveStudioCountry(null, undefined)).toEqual({ code: null, source: null });
  });
});
