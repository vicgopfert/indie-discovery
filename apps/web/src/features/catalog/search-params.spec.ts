import { describe, expect, it } from 'vitest';
import { catalogHref, parseCatalogParams } from './search-params';

const query = (params: Record<string, string | string[]>) => {
  const parsed = parseCatalogParams(params);
  if (!parsed.ok) throw new Error(parsed.errors.join(' '));
  return parsed.query;
};

describe('parseCatalogParams', () => {
  it('sem parâmetros, usa a primeira página dos mais populares', () => {
    expect(parseCatalogParams({})).toEqual({
      ok: true,
      query: { genre: [], theme: [], country: [], sort: 'popular', page: 1, pageSize: 24 },
    });
  });

  it('ignora os campos que o formulário envia vazios', () => {
    expect(query({ q: '', status: '', portuguese: '', genre: ['', 'puzzle'] })).toMatchObject({
      genre: ['puzzle'],
    });
    expect(query({ status: '' }).status).toBeUndefined();
  });

  it('lê filtros repetidos e normaliza o país', () => {
    expect(query({ genre: ['puzzle', 'adventure'], country: 'br', page: '2' })).toMatchObject({
      genre: ['puzzle', 'adventure'],
      country: ['BR'],
      page: 2,
    });
  });

  it('URL inválida devolve as mensagens com o nome do filtro em português', () => {
    expect(parseCatalogParams({ genre: ['a', 'b', 'c', 'd', 'e', 'f'], page: 'abc' })).toEqual({
      ok: false,
      errors: ['Gênero: Até 5 valores por filtro.', 'Página: A página deve ser um número.'],
    });
  });
});

describe('catalogHref', () => {
  it('sem filtros, é só o caminho do catálogo', () => {
    expect(catalogHref(query({}))).toBe('/catalogo');
  });

  it('leva todos os filtros e deixa de fora os valores padrão', () => {
    const filtered = query({
      q: 'knight',
      genre: ['platform', 'adventure'],
      theme: 'fantasy',
      status: 'released',
      portuguese: 'yes',
      country: ['US', 'unknown'],
      sort: 'newest',
    });

    expect(catalogHref(filtered)).toBe(
      '/catalogo?q=knight&genre=platform&genre=adventure&theme=fantasy&status=released&portuguese=yes&country=US&country=unknown&sort=newest',
    );
  });

  it('troca só a página, mantendo os filtros', () => {
    const filtered = query({ genre: 'puzzle', page: '3' });

    expect(catalogHref(filtered, 4)).toBe('/catalogo?genre=puzzle&page=4');
    expect(catalogHref(filtered, 1)).toBe('/catalogo?genre=puzzle');
  });

  it('a busca é codificada na URL', () => {
    expect(catalogHref(query({ q: '100% suco & cia' }))).toBe('/catalogo?q=100%25+suco+%26+cia');
  });
});
