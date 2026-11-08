import type { GameDetail, GameLanguage, StudioCountry } from '@indie/contracts';

export const NOT_INFORMED = 'Não informado';

// Mesma regra do filtro da API: pt-PT também conta como português.
const PORTUGUESE_LOCALES = ['pt-BR', 'pt-PT'];

const SOURCE_NAMES: Record<StudioCountry['source'], string> = {
  IGDB: 'IGDB',
  WIKIDATA: 'Wikidata',
};

const listFormat = new Intl.ListFormat('pt-BR', { type: 'conjunction' });

export function languageSupport({ name, interface: ui, subtitles, audio }: GameLanguage) {
  const kinds = [ui && 'interface', subtitles && 'legendas', audio && 'áudio'].filter(
    (kind): kind is string => Boolean(kind),
  );
  return kinds.length > 0 ? `${name}: ${listFormat.format(kinds)}` : name;
}

// Sem nenhum idioma informado é "não informado", não "sem português" (F-06).
export function portugueseSupport(languages: GameLanguage[]) {
  if (languages.length === 0) return ['Idiomas não informados'];
  const portuguese = languages.filter(({ locale }) => PORTUGUESE_LOCALES.includes(locale));
  return portuguese.length > 0 ? portuguese.map(languageSupport) : ['Sem português'];
}

export const companyNames = (names: string[]) =>
  names.length > 0 ? listFormat.format(names) : NOT_INFORMED;

export const countrySource = ({ source }: StudioCountry) => `fonte: ${SOURCE_NAMES[source]}`;

export interface TagAttribution {
  text: string;
  href: string | null;
}

// A atribuição cita a comunidade Steam e leva à página do jogo na loja, sem sugerir endosso da
// Valve; as etiquetas da reserva dizem de onde vieram (B-78).
export function tagAttribution({
  tags,
  tagSource,
  steamAppId,
}: Pick<GameDetail, 'tags' | 'tagSource' | 'steamAppId'>): TagAttribution | null {
  if (tags.length === 0 || tagSource === null) return null;
  if (tagSource === 'IGDB') {
    return {
      text: 'Etiquetas atribuídas pelo resumo e pelas palavras-chave da IGDB',
      href: null,
    };
  }
  return {
    text: 'Etiquetas da comunidade Steam',
    href: steamAppId === null ? null : `https://store.steampowered.com/app/${steamAppId}`,
  };
}

// Corta na última palavra inteira que cabe, para o resumo caber nos resultados de busca.
export function metaDescription(summary: string, maxLength = 160) {
  const text = summary.replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[\s,.;:]+$/, '')}…`;
}
