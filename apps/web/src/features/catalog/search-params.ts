import {
  GAMES_PAGE_SIZE_DEFAULT,
  type GameSearchQuery,
  GameSearchQuerySchema,
} from '@indie/contracts';

export const CATALOG_PATH = '/catalogo';

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export type ParsedCatalogParams =
  { ok: true; query: GameSearchQuery } | { ok: false; errors: string[] };

const FILTER_LABELS: Record<string, string> = {
  q: 'Busca',
  genre: 'Gênero',
  theme: 'Tema',
  status: 'Situação',
  portuguese: 'Português',
  country: 'País',
  sort: 'Ordenação',
  page: 'Página',
  pageSize: 'Tamanho da página',
};

// Campos vazios do formulário (busca em branco, "Todas") chegam como "status=" e valem como ausentes.
export function parseCatalogParams(params: CatalogSearchParams): ParsedCatalogParams {
  const present = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) => {
      const values = [value ?? []].flat().filter((item) => item !== '');
      if (values.length === 0) return [];
      return [[key, values.length === 1 ? values[0] : values]];
    }),
  );

  const parsed = GameSearchQuerySchema.safeParse(present);
  if (parsed.success) return { ok: true, query: parsed.data };
  return {
    ok: false,
    errors: parsed.error.issues.map(({ path, message }) => {
      const field = String(path[0]);
      return `${FILTER_LABELS[field] ?? field}: ${message}`;
    }),
  };
}

// Valores padrão ficam de fora: a URL do catálogo sem filtros é só /catalogo.
export function toSearchParams(query: GameSearchQuery, page = query.page) {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  for (const genre of query.genre) params.append('genre', genre);
  for (const theme of query.theme) params.append('theme', theme);
  if (query.status) params.set('status', query.status);
  if (query.portuguese) params.set('portuguese', query.portuguese);
  for (const country of query.country) params.append('country', country);
  if (query.sort !== 'popular') params.set('sort', query.sort);
  if (page > 1) params.set('page', String(page));
  if (query.pageSize !== GAMES_PAGE_SIZE_DEFAULT) params.set('pageSize', String(query.pageSize));
  return params;
}

export function catalogHref(query: GameSearchQuery, page = query.page) {
  const search = toSearchParams(query, page).toString();
  return search ? `${CATALOG_PATH}?${search}` : CATALOG_PATH;
}
