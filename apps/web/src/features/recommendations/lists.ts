import {
  type RecommendationFeature,
  type RecommendationLikedGame,
  RecommendationPageQuerySchema,
} from '@indie/contracts';

export const RECOMMENDATIONS_PATH = '/recomendacoes';

const MAIN_KEY = 'main';
const UPCOMING_KEY = 'upcoming';

// Na URL, a chave da API vai em português: main → para-voce, theme:horror → tema-horror,
// game:celeste → jogo-celeste. Os prefixos não têm hífen, então o slug, que pode ter, é tudo o que
// vem depois do primeiro.
const FIXED_SEGMENTS = new Map([
  [MAIN_KEY, 'para-voce'],
  [UPCOMING_KEY, 'em-breve'],
]);
const INTEREST_PREFIXES = new Map([
  ['game', 'jogo'],
  ['genre', 'genero'],
  ['theme', 'tema'],
  ['tag', 'etiqueta'],
]);

const invert = (map: Map<string, string>) => new Map([...map].map(([key, value]) => [value, key]));
const KEYS_BY_SEGMENT = invert(FIXED_SEGMENTS);
const TYPES_BY_PREFIX = invert(INTEREST_PREFIXES);

export function listSegment(key: string) {
  const fixed = FIXED_SEGMENTS.get(key);
  if (fixed) return fixed;
  const [type, slug] = splitAt(key, ':');
  return `${INTEREST_PREFIXES.get(type)}-${slug}`;
}

// Um segmento fora do formato não é lista nenhuma; um no formato pode não ser uma lista do
// perfil, o que só a API sabe.
export function listKeyOf(segment: string): string | null {
  const fixed = KEYS_BY_SEGMENT.get(segment);
  if (fixed) return fixed;
  const [prefix, slug] = splitAt(segment, '-');
  const type = TYPES_BY_PREFIX.get(prefix);
  return type && slug ? `${type}:${slug}` : null;
}

export function listHref(key: string, page = 1) {
  const path = `${RECOMMENDATIONS_PATH}/${listSegment(key)}`;
  return page > 1 ? `${path}?page=${page}` : path;
}

// A prateleira por jogo leva o nome do jogo de origem, e a de interesse, o título do atributo. Sem
// eles ainda carregados, fica o título da página.
export function listTitle(
  key: string,
  about?: { feature: RecommendationFeature | null; game?: RecommendationLikedGame | null },
) {
  if (key === MAIN_KEY) return 'Para você';
  if (key === UPCOMING_KEY) return 'Em breve no seu gosto';
  if (about?.game) return `Porque você gostou de ${about.game.name}`;
  if (about?.feature) return `Porque você curte ${about.feature.title}`;
  return 'Recomendações';
}

// Uma página inválida vira a primeira, como um endereço sem página.
export function parseListPage(value: string | string[] | undefined) {
  const parsed = RecommendationPageQuerySchema.pick({ page: true }).safeParse({ page: value });
  return parsed.success ? parsed.data.page : 1;
}

function splitAt(text: string, separator: string): [string, string] {
  const at = text.indexOf(separator);
  return at < 0 ? [text, ''] : [text.slice(0, at), text.slice(at + 1)];
}
