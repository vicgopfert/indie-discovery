import type { CollectionDetail } from '@indie/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sampleCollectionDetail, sampleGame } from '@/test/catalog';
import { apiError, stubFetch } from '@/test/fetch';
import CollectionPage, { generateMetadata } from './page';

const NOT_FOUND = 'NEXT_NOT_FOUND';
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

const props = (page?: string | string[], slug = 'brasil') => ({
  params: Promise.resolve({ slug }),
  searchParams: Promise.resolve(page === undefined ? {} : { page }),
});

const stubCollection = (detail: CollectionDetail) => stubFetch(() => Response.json(detail));

const renderPage = async (page?: string | string[], slug?: string) =>
  render(await CollectionPage(props(page, slug)));

const games = (count: number) =>
  Array.from({ length: count }, (_, i) => sampleGame({ slug: `jogo-${i}`, name: `Jogo ${i}` }));

describe('CollectionPage', () => {
  it('busca a coleção pelo slug e mostra o nome, a descrição, a contagem e os jogos', async () => {
    const fetchMock = stubCollection(sampleCollectionDetail(games(2)));

    await renderPage();

    expect(fetchMock).toHaveBeenCalledWith('/api/collections/brasil', expect.anything());
    expect(screen.getByRole('heading', { level: 1, name: 'Brasil' })).toBeInTheDocument();
    expect(
      screen.getByText('Folclore, povos originários, história e cotidiano do Brasil.'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 jogos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Jogo 1' })).toHaveAttribute('href', '/jogos/jogo-1');
    expect(screen.getByRole('link', { name: 'Todas as coleções' })).toHaveAttribute(
      'href',
      '/colecoes',
    );
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument();
  });

  it('pede a página da URL e liga a anterior e a próxima', async () => {
    const fetchMock = stubCollection(sampleCollectionDetail(games(24), { page: 2, total: 60 }));

    await renderPage('2');

    expect(fetchMock).toHaveBeenCalledWith('/api/collections/brasil?page=2', expect.anything());
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      '/colecoes/brasil',
    );
    expect(screen.getByRole('link', { name: 'Próxima' })).toHaveAttribute(
      'href',
      '/colecoes/brasil?page=3',
    );
  });

  it.each([['abc'], ['0'], [['2', '3']]])(
    'página inválida (%j) mostra a primeira',
    async (page) => {
      const fetchMock = stubCollection(sampleCollectionDetail());

      await renderPage(page);

      expect(fetchMock).toHaveBeenCalledWith('/api/collections/brasil', expect.anything());
      expect(screen.getByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    },
  );

  it('página além da última leva de volta à primeira', async () => {
    stubCollection(sampleCollectionDetail([], { page: 9, total: 30 }));

    await renderPage('9');

    expect(screen.getByRole('link', { name: 'Voltar para a primeira página' })).toHaveAttribute(
      'href',
      '/colecoes/brasil',
    );
  });

  it('coleção inexistente vai para a página de não encontrada', async () => {
    stubFetch(() => apiError(404, 'Coleção não encontrada.'));

    await expect(CollectionPage(props(undefined, 'nao-existe'))).rejects.toThrow(NOT_FOUND);
  });

  it('se a API falhar, avisa e oferece tentar de novo na mesma página', async () => {
    stubFetch(() => {
      throw new TypeError('fetch failed');
    });

    await renderPage('2');

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar a coleção');
    expect(screen.getByRole('link', { name: 'Tentar de novo' })).toHaveAttribute(
      'href',
      '/colecoes/brasil?page=2',
    );
  });

  it('o título da aba é o nome da coleção, e a descrição vai nos metadados', async () => {
    stubCollection(sampleCollectionDetail());

    expect(await generateMetadata(props())).toEqual({
      title: 'Brasil',
      description: 'Folclore, povos originários, história e cotidiano do Brasil.',
    });
  });
});
