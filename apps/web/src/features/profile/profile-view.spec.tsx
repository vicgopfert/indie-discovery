import type { Library, LibraryGame, Preferences } from '@indie/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sampleGame } from '@/test/catalog';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { ProfileView } from './profile-view';

const AT = '2026-11-16T12:00:00.000Z';

const celeste: LibraryGame = { ...sampleGame(), inCatalog: true };
const hades: LibraryGame = { ...sampleGame({ slug: 'hades', name: 'Hades' }), inCatalog: true };
const gone: LibraryGame = {
  ...sampleGame({ slug: 'jogo-removido', name: 'Jogo Removido' }),
  inCatalog: false,
};

const noPreferences: Preferences = { genres: [], themes: [], tags: [] };
const somePreferences: Preferences = {
  genres: [{ slug: 'platform', name: 'Plataforma' }],
  themes: [{ slug: 'horror', name: 'Terror' }],
  tags: [],
};

const emptyLibrary = (): Library => ({
  ratings: [],
  lists: { FAVORITE: [], COMPLETED: [], WANT_TO_PLAY: [] },
});

const entry = (game: LibraryGame) => ({ game, addedAt: AT });

// Uma API com sessão que guarda a biblioteca e aplica as remoções, como o servidor.
function stubProfile({
  library = emptyLibrary(),
  preferences = somePreferences,
  reply,
}: {
  library?: Library;
  preferences?: Preferences;
  reply?: (path: string, method: string) => Response | undefined;
} = {}) {
  let current = library;
  return stubFetch((path, method) => {
    const replied = reply?.(path, method);
    if (replied) return replied;
    if (path === '/api/auth/me') return Response.json(sampleUser);
    if (path === '/api/me/preferences') return Response.json(preferences);
    if (path === '/api/me/library') return Response.json(current);

    const rating = /^\/api\/me\/ratings\/(.+)$/.exec(path);
    if (rating && method === 'DELETE') {
      current = { ...current, ratings: current.ratings.filter((r) => r.game.slug !== rating[1]) };
      return new Response(null, { status: 204 });
    }
    if (rating && method === 'PUT') return Response.json({ score: 2, updatedAt: AT });

    const list = /^\/api\/me\/lists\/favorite\/(.+)$/.exec(path);
    if (list && method === 'DELETE') {
      current = {
        ...current,
        lists: {
          ...current.lists,
          FAVORITE: current.lists.FAVORITE.filter(({ game }) => game.slug !== list[1]),
        },
      };
      return new Response(null, { status: 204 });
    }
    return apiError(404, `Rota inesperada: ${method} ${path}`);
  });
}

const section = (name: RegExp) => screen.findByRole('region', { name });

describe('ProfileView', () => {
  it('sem sessão, convida a entrar e volta para o perfil', async () => {
    stubFetch(() => apiError(401, 'Sessão ausente ou expirada'));
    renderWithQuery(<ProfileView />);

    expect(await screen.findByRole('link', { name: 'Entre' })).toHaveAttribute(
      'href',
      '/entrar?next=%2Fperfil',
    );
  });

  it('mostra o avatar com as iniciais, o nome, os gostos, as notas e as listas', async () => {
    stubProfile({
      library: {
        ratings: [{ game: celeste, score: 4, updatedAt: AT }],
        lists: { FAVORITE: [entry(celeste)], COMPLETED: [], WANT_TO_PLAY: [entry(hades)] },
      },
    });
    renderWithQuery(<ProfileView />);

    expect(await screen.findByText('Jogadora')).toBeInTheDocument();
    expect(screen.getByText('J')).toHaveAttribute('aria-hidden', 'true');

    const tastes = await section(/Gostos/);
    expect(tastes).toHaveTextContent('Gêneros: Plataforma');
    expect(tastes).toHaveTextContent('Temas: Terror');
    expect(tastes).not.toHaveTextContent('Etiquetas');
    expect(within(tastes).getByRole('link', { name: 'Mudar meus gostos' })).toHaveAttribute(
      'href',
      '/boas-vindas?next=%2Fperfil',
    );

    const ratings = await section(/Avaliações \(1\)/);
    expect(within(ratings).getByRole('link', { name: 'Celeste' })).toHaveAttribute(
      'href',
      '/jogos/celeste',
    );
    expect(
      within(within(ratings).getByRole('group', { name: 'Sua nota para Celeste' })).getByRole(
        'button',
        { name: '4' },
      ),
    ).toHaveAttribute('aria-pressed', 'true');

    expect(within(await section(/Favoritos \(1\)/)).getByText('Celeste')).toBeInTheDocument();
    expect(within(await section(/Quero jogar \(1\)/)).getByText('Hades')).toBeInTheDocument();
    expect(await section(/Concluídos \(0\)/)).toHaveTextContent('Nenhum jogo concluído ainda.');
  });

  it('com tudo vazio, orienta a escolher os gostos', async () => {
    stubProfile({ preferences: noPreferences });
    renderWithQuery(<ProfileView />);

    expect(await screen.findByText(/Seu perfil ainda está vazio/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Escolher meus gostos' })).toHaveAttribute(
      'href',
      '/boas-vindas?next=%2Fperfil',
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('cada seção vazia orienta o próximo passo', async () => {
    stubProfile();
    renderWithQuery(<ProfileView />);

    const ratings = await section(/Avaliações \(0\)/);
    expect(ratings).toHaveTextContent('Você ainda não avaliou nenhum jogo.');
    expect(within(ratings).getByRole('link', { name: 'Explorar o catálogo' })).toHaveAttribute(
      'href',
      '/catalogo',
    );
    expect(await section(/Favoritos \(0\)/)).toHaveTextContent(
      'Nenhum favorito ainda. Marque Favorito na ficha de um jogo.',
    );
    const wantToPlay = await section(/Quero jogar \(0\)/);
    expect(wantToPlay).toHaveTextContent('Nenhum jogo para jogar depois.');
    expect(within(wantToPlay).getByRole('link', { name: 'Ver recomendações' })).toHaveAttribute(
      'href',
      '/recomendacoes',
    );
  });

  it('sem gostos escolhidos, mas com notas, oferece escolhê-los', async () => {
    stubProfile({
      preferences: noPreferences,
      library: { ...emptyLibrary(), ratings: [{ game: celeste, score: 4, updatedAt: AT }] },
    });
    renderWithQuery(<ProfileView />);

    const tastes = await section(/Gostos/);
    expect(tastes).toHaveTextContent('Você ainda não escolheu seus gostos.');
    expect(within(tastes).getByRole('link', { name: 'Escolher meus gostos' })).toHaveAttribute(
      'href',
      '/boas-vindas?next=%2Fperfil',
    );
  });

  it('remove a nota: o jogo sai da seção, o aviso é anunciado e o foco vai para o título', async () => {
    const fetchMock = stubProfile({
      library: { ...emptyLibrary(), ratings: [{ game: celeste, score: 4, updatedAt: AT }] },
    });
    renderWithQuery(<ProfileView />);

    const ratings = await section(/Avaliações \(1\)/);
    await userEvent.click(within(ratings).getByRole('button', { name: 'Remover nota' }));

    expect(await section(/Avaliações \(0\)/)).toHaveTextContent('Você ainda não avaliou');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/ratings/celeste',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(screen.getByText('Nota de Celeste removida.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Avaliações (0)' })).toHaveFocus();
  });

  it('muda a nota pela página', async () => {
    const fetchMock = stubProfile({
      library: { ...emptyLibrary(), ratings: [{ game: celeste, score: 4, updatedAt: AT }] },
    });
    renderWithQuery(<ProfileView />);

    const ratings = await section(/Avaliações \(1\)/);
    await userEvent.click(within(ratings).getByRole('button', { name: '2' }));

    expect(await screen.findByText('Nota de Celeste alterada para 2.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/ratings/celeste',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ score: 2 }) }),
    );
  });

  it('tira de uma lista e mantém o jogo nas outras, também no cache da ficha', async () => {
    stubProfile({
      library: {
        ...emptyLibrary(),
        lists: { FAVORITE: [entry(celeste)], COMPLETED: [entry(celeste)], WANT_TO_PLAY: [] },
      },
    });
    const { queryClient } = renderWithQuery(<ProfileView />);

    const favorites = await section(/Favoritos \(1\)/);
    await userEvent.click(within(favorites).getByRole('button', { name: 'Tirar de Favoritos' }));

    expect(await section(/Favoritos \(0\)/)).toBeInTheDocument();
    expect(within(await section(/Concluídos \(1\)/)).getByText('Celeste')).toBeInTheDocument();
    expect(screen.getByText('Celeste saiu de Favoritos.')).toBeInTheDocument();
    expect(queryClient.getQueryData(['library', 'celeste'])).toEqual({
      rating: null,
      lists: ['COMPLETED'],
    });
  });

  it('o jogo fora do catálogo aparece sem link, marcado, e só pode ser removido', async () => {
    stubProfile({
      library: { ...emptyLibrary(), ratings: [{ game: gone, score: 5, updatedAt: AT }] },
    });
    renderWithQuery(<ProfileView />);

    const ratings = await section(/Avaliações \(1\)/);
    expect(within(ratings).getByText('Jogo Removido')).toBeInTheDocument();
    expect(within(ratings).queryByRole('link')).not.toBeInTheDocument();
    expect(within(ratings).getByText('Fora do catálogo')).toBeInTheDocument();
    expect(within(ratings).getByText('Sua nota: 5')).toBeInTheDocument();
    expect(within(ratings).queryByRole('button', { name: '5' })).not.toBeInTheDocument();

    await userEvent.click(within(ratings).getByRole('button', { name: 'Remover nota' }));

    expect(await section(/Avaliações \(0\)/)).toBeInTheDocument();
  });

  it('se a gravação falha, avisa no jogo e o mantém na seção', async () => {
    stubProfile({
      library: { ...emptyLibrary(), ratings: [{ game: celeste, score: 4, updatedAt: AT }] },
      reply: (path, method) =>
        method === 'DELETE' ? apiError(500, 'Erro interno no servidor.') : undefined,
    });
    renderWithQuery(<ProfileView />);

    const ratings = await section(/Avaliações \(1\)/);
    await userEvent.click(within(ratings).getByRole('button', { name: 'Remover nota' }));

    expect(await within(ratings).findByRole('alert')).toHaveTextContent(
      'Erro interno no servidor.',
    );
    expect(within(ratings).getByText('Celeste')).toBeInTheDocument();
  });

  it('se a biblioteca não carrega, avisa', async () => {
    stubProfile({
      reply: (path) =>
        path === '/api/me/library' ? apiError(500, 'Erro interno no servidor.') : undefined,
    });
    renderWithQuery(<ProfileView />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível carregar o seu perfil',
    );
  });

  it('com a sessão vencida, volta ao convite para entrar', async () => {
    stubProfile({
      reply: (path) =>
        path === '/api/me/library' ? apiError(401, 'Sessão ausente ou expirada') : undefined,
    });
    renderWithQuery(<ProfileView />);

    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Entre' })).toHaveAttribute(
        'href',
        '/entrar?next=%2Fperfil',
      ),
    );
  });
});
