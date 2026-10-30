import type { GameDetail } from '@indie/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { sampleGameDetail } from '@/test/catalog';
import { apiError, stubFetch } from '@/test/fetch';
import GamePage, { generateMetadata } from './page';

const NOT_FOUND = 'NEXT_NOT_FOUND';
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

const props = (slug = 'celeste') => ({ params: Promise.resolve({ slug }) });

const stubGame = (game: GameDetail) => stubFetch(() => Response.json(game));

// O valor de um item da ficha, como "Português" ou "Publicação".
const fact = (term: string) => screen.getByText(term, { selector: 'dt' }).nextElementSibling;

const renderPage = async (slug?: string) => render(await GamePage(props(slug)));

describe('GamePage', () => {
  it('busca o jogo pelo slug e mostra a ficha', async () => {
    const fetchMock = stubGame(sampleGameDetail());

    await renderPage();

    expect(fetchMock).toHaveBeenCalledWith('/api/games/celeste', expect.anything());
    expect(screen.getByRole('heading', { level: 1, name: 'Celeste' })).toBeInTheDocument();
    expect(screen.getByText('Ajude Madeline a escalar a montanha Celeste.')).toBeInTheDocument();
    expect(fact('Desenvolvimento')).toHaveTextContent('Extremely OK Games');
    expect(fact('Publicação')).toHaveTextContent('Maddy Makes Games');
    expect(fact('País do estúdio')).toHaveTextContent('Canadá (fonte: IGDB)');
    expect(fact('Português')).toHaveTextContent('Português (Brasil): interface e legendas');
  });

  it('a capa grande vem da CDN da IGDB, carregada logo', async () => {
    stubGame(sampleGameDetail());

    const { container } = await renderPage();

    const cover = container.querySelector('img');
    expect(cover).toHaveAttribute(
      'src',
      'https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3byy.jpg',
    );
    expect(cover).not.toHaveAttribute('loading', 'lazy');
  });

  it('a página oficial e a IGDB abrem em nova aba', async () => {
    stubGame(sampleGameDetail());

    await renderPage();

    for (const [name, href] of [
      ['Página oficial', 'https://www.celestegame.com'],
      ['IGDB', 'https://www.igdb.com/games/celeste'],
    ] as const) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', href);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('gêneros, temas e país levam ao catálogo filtrado', async () => {
    stubGame(sampleGameDetail());

    await renderPage();

    expect(screen.getByRole('link', { name: 'Plataforma' })).toHaveAttribute(
      'href',
      '/catalogo?genre=platform',
    );
    expect(screen.getByRole('link', { name: 'Ação' })).toHaveAttribute(
      'href',
      '/catalogo?theme=action',
    );
    expect(screen.getByRole('link', { name: 'Canadá' })).toHaveAttribute(
      'href',
      '/catalogo?country=CA',
    );
  });

  it('jogo em breve tem o selo e a data prevista', async () => {
    stubGame(sampleGameDetail({ releaseStatus: 'UPCOMING', firstReleaseDate: null }));

    await renderPage();

    expect(screen.getByText('Em breve')).toBeInTheDocument();
    expect(screen.getByText('Sem data prevista')).toBeInTheDocument();
  });

  it('sem os dados opcionais, diz que não foram informados', async () => {
    stubGame(
      sampleGameDetail({
        coverImageId: '',
        themes: [],
        developers: [],
        publishers: [],
        studioCountry: null,
        languages: [],
        officialUrl: null,
      }),
    );

    const { container } = await renderPage();

    expect(container.querySelector('img')).not.toBeInTheDocument();
    for (const term of ['Temas', 'Desenvolvimento', 'Publicação', 'País do estúdio']) {
      expect(fact(term)).toHaveTextContent('Não informado');
    }
    expect(fact('Português')).toHaveTextContent('Idiomas não informados');
    expect(screen.getByText('Link oficial não informado')).toBeInTheDocument();
    expect(screen.queryByText(/Todos os idiomas/)).not.toBeInTheDocument();
  });

  it('jogo inexistente ou fora do catálogo vira a página 404', async () => {
    stubFetch(() => apiError(404, 'Jogo não encontrado.'));

    await expect(GamePage(props('nao-existe'))).rejects.toThrow(NOT_FOUND);
  });

  it('se a API falhar, avisa e oferece tentar de novo', async () => {
    stubFetch(() => {
      throw new TypeError('fetch failed');
    });

    await renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar o jogo');
    expect(screen.getByRole('link', { name: 'Tentar de novo' })).toHaveAttribute(
      'href',
      '/jogos/celeste',
    );
  });
});

describe('generateMetadata', () => {
  it('usa o nome, o resumo e a capa grande do jogo', async () => {
    stubGame(sampleGameDetail());

    expect(await generateMetadata(props())).toEqual({
      title: 'Celeste',
      description: 'Ajude Madeline a escalar a montanha Celeste.',
      openGraph: {
        title: 'Celeste',
        description: 'Ajude Madeline a escalar a montanha Celeste.',
        images: ['https://images.igdb.com/igdb/image/upload/t_cover_big_2x/co3byy.jpg'],
      },
    });
  });

  it('sem capa, não indica imagem', async () => {
    stubGame(sampleGameDetail({ coverImageId: '' }));

    const metadata = await generateMetadata(props());

    expect(metadata.openGraph).not.toHaveProperty('images');
  });

  it('jogo inexistente dá título de não encontrado, sem interromper a renderização', async () => {
    stubFetch(() => apiError(404, 'Jogo não encontrado.'));

    await expect(generateMetadata(props('nao-existe'))).resolves.toEqual({
      title: 'Jogo não encontrado',
    });
  });
});
