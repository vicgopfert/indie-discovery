import { StudioCountrySource } from '../../../generated/prisma/client';

// Países que o Wikidata dá a um jogo, como código numérico ISO 3166-1: o da desenvolvedora
// (P178 → P17) e o de origem do jogo (P495).
export interface WikidataCountries {
  developer: ReadonlySet<number>;
  origin: ReadonlySet<number>;
}

export interface StudioCountry {
  code: number | null;
  source: StudioCountrySource | null;
}

const NONE: StudioCountry = { code: null, source: null };

// A IGDB vem primeiro: o Wikidata diverge dela em 4,6% dos jogos que os dois informam, e os erros
// aparecem dos dois lados. No Wikidata, o país da desenvolvedora vem antes do país de origem do
// jogo, que só conta quando o Wikidata não tem desenvolvedora com país. Mais de um país é ambíguo.
export function resolveStudioCountry(
  igdbCode: number | null,
  wikidata: WikidataCountries | undefined,
): StudioCountry {
  if (igdbCode !== null) return { code: igdbCode, source: StudioCountrySource.IGDB };
  if (!wikidata) return NONE;
  const candidates = wikidata.developer.size > 0 ? wikidata.developer : wikidata.origin;
  return candidates.size === 1
    ? { code: [...candidates][0]!, source: StudioCountrySource.WIKIDATA }
    : NONE;
}
