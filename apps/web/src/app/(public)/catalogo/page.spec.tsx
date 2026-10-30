import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sampleGame } from '@/test/catalog';
import { stubFetch } from '@/test/fetch';
import CatalogPage from './page';

vi.mock('next/form', () => import('@/test/next-form'));

const page = (items = [sampleGame()], total = items.length, pageNumber = 1) => ({
  items,
  page: pageNumber,
  pageSize: 24,
  total,
  totalPages: Math.ceil(total / 24),
});

function stubCatalog(games: ReturnType<typeof page>) {
  return stubFetch((path) => {
    if (path.startsWith('/api/games')) return Response.json(games);
    if (path.startsWith('/api/countries')) return Response.json([]);
    return Response.json([{ slug: 'puzzle', name: 'Quebra-cabeça', gameCount: 3607 }]);
  });
}

const renderPage = async (searchParams: Record<string, string | string[]> = {}) =>
  render(await CatalogPage({ searchParams: Promise.resolve(searchParams) }));

describe('CatalogPage', () => {
  it('repassa os filtros da URL à API e mostra os jogos com o total', async () => {
    const fetchMock = stubCatalog(page([sampleGame()], 30));

    await renderPage({ genre: 'puzzle', portuguese: 'yes', country: 'br', page: '' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/games?genre=puzzle&portuguese=yes&country=BR',
      expect.anything(),
    );
    expect(screen.getByText('30 jogos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Próxima' })).toHaveAttribute(
      'href',
      '/catalogo?genre=puzzle&portuguese=yes&country=BR&page=2',
    );
  });

  it('sem jogos, diz que nada atende e oferece limpar os filtros', async () => {
    stubCatalog(page([], 0));

    await renderPage({ genre: 'puzzle' });

    expect(screen.getByText(/Nenhum jogo com esses filtros/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Limpar filtros' })).not.toHaveLength(0);
  });

  it('página além do fim leva de volta à primeira', async () => {
    stubCatalog(page([], 30, 9));

    await renderPage({ genre: 'puzzle', page: '9' });

    expect(screen.getByRole('link', { name: 'Voltar para a primeira página' })).toHaveAttribute(
      'href',
      '/catalogo?genre=puzzle',
    );
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument();
  });

  it('URL inválida mostra o problema sem chamar a API', async () => {
    const fetchMock = stubCatalog(page());

    await renderPage({ page: 'abc' });

    expect(screen.getByRole('alert')).toHaveTextContent('Página: A página deve ser um número.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('se a API falhar, avisa e oferece tentar de novo na mesma busca', async () => {
    stubFetch(() => {
      throw new TypeError('fetch failed');
    });

    await renderPage({ genre: 'puzzle' });

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o catálogo');
    expect(screen.getByRole('link', { name: 'Tentar de novo' })).toHaveAttribute(
      'href',
      '/catalogo?genre=puzzle',
    );
  });
});
