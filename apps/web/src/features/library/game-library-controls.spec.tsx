import type { GameLibraryState } from '@indie/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SESSION_QUERY_KEY } from '@/features/auth/hooks';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { GameLibraryControls } from './game-library-controls';
import { RECOMMENDATIONS_QUERY_KEY } from './hooks';

const RATED_AT = '2026-11-03T12:00:00.000Z';

// Uma API com a sessão e o estado do jogo; `reply` responde as gravações.
function stubLibrary(
  state: GameLibraryState,
  reply: (path: string, method: string) => Response = () => new Response(null, { status: 204 }),
) {
  return stubFetch((path, method) => {
    if (path === '/api/auth/me') return Response.json(sampleUser);
    if (path === '/api/me/library/celeste' && method === 'GET') return Response.json(state);
    return reply(path, method);
  });
}

const renderControls = () => renderWithQuery(<GameLibraryControls slug="celeste" />);

const scoreButton = (score: number) => screen.findByRole('button', { name: String(score) });
const listButton = (name: string) => screen.findByRole('button', { name });

describe('GameLibraryControls', () => {
  it('sem sessão, convida a entrar e volta para a ficha, sem nenhum controle', async () => {
    stubFetch(() => apiError(401, 'Sessão ausente ou expirada'));
    renderControls();

    expect(await screen.findByRole('link', { name: 'Entre' })).toHaveAttribute(
      'href',
      '/entrar?next=%2Fjogos%2Fceleste',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('com sessão, mostra a nota e as listas gravadas', async () => {
    stubLibrary({ rating: { score: 4, updatedAt: RATED_AT }, lists: ['FAVORITE'] });
    renderControls();

    expect(await scoreButton(4)).toHaveAttribute('aria-pressed', 'true');
    expect(await scoreButton(5)).toHaveAttribute('aria-pressed', 'false');
    expect(await listButton('Favorito')).toHaveAttribute('aria-pressed', 'true');
    expect(await listButton('Quero jogar')).toHaveAttribute('aria-pressed', 'false');
  });

  it('avalia e remove a nota', async () => {
    const fetchMock = stubLibrary({ rating: null, lists: [] }, (path, method) =>
      method === 'PUT'
        ? Response.json({ score: 5, updatedAt: RATED_AT })
        : new Response(null, { status: 204 }),
    );
    renderControls();
    expect(screen.queryByRole('button', { name: 'Remover nota' })).not.toBeInTheDocument();

    await userEvent.click(await scoreButton(5));

    expect(await scoreButton(5)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Salvo.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/ratings/celeste',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ score: 5 }) }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Remover nota' }));

    await waitFor(async () =>
      expect(await scoreButton(5)).toHaveAttribute('aria-pressed', 'false'),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/ratings/celeste',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('em "Concluído", tira de "Quero jogar" pelo que a API responde', async () => {
    const fetchMock = stubLibrary({ rating: null, lists: ['WANT_TO_PLAY'] }, () =>
      Response.json({ lists: ['COMPLETED'] }),
    );
    renderControls();

    await userEvent.click(await listButton('Concluído'));

    expect(await listButton('Concluído')).toHaveAttribute('aria-pressed', 'true');
    expect(await listButton('Quero jogar')).toHaveAttribute('aria-pressed', 'false');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/lists/completed/celeste',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('tira da lista com DELETE', async () => {
    const fetchMock = stubLibrary({ rating: null, lists: ['FAVORITE', 'COMPLETED'] });
    renderControls();

    await userEvent.click(await listButton('Favorito'));

    await waitFor(async () =>
      expect(await listButton('Favorito')).toHaveAttribute('aria-pressed', 'false'),
    );
    expect(await listButton('Concluído')).toHaveAttribute('aria-pressed', 'true');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/me/lists/favorite/celeste',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('desabilita os controles enquanto salva', async () => {
    let finish: (response: Response) => void = () => undefined;
    stubFetch((path, method) => {
      if (path === '/api/auth/me') return Response.json(sampleUser);
      if (method === 'GET') return Response.json({ rating: null, lists: [] });
      return new Promise<Response>((resolve) => (finish = resolve)) as unknown as Response;
    });
    renderControls();

    await userEvent.click(await scoreButton(3));

    expect(await scoreButton(1)).toBeDisabled();
    expect(await listButton('Favorito')).toBeDisabled();
    expect(screen.getByText('Salvando…')).toBeInTheDocument();
    finish(Response.json({ score: 3, updatedAt: RATED_AT }));
    await waitFor(async () => expect(await scoreButton(1)).toBeEnabled());
  });

  it('mostra o erro da API sem mudar o que estava marcado', async () => {
    stubLibrary({ rating: { score: 2, updatedAt: RATED_AT }, lists: [] }, () =>
      apiError(404, 'Jogo não encontrado.'),
    );
    renderControls();

    await userEvent.click(await scoreButton(4));

    expect(await screen.findByRole('alert')).toHaveTextContent('Jogo não encontrado.');
    expect(await scoreButton(2)).toHaveAttribute('aria-pressed', 'true');
  });

  it('com a sessão vencida, volta ao convite para entrar', async () => {
    stubLibrary({ rating: null, lists: [] }, () => apiError(401, 'Sessão ausente ou expirada'));
    const { queryClient } = renderControls();

    await userEvent.click(await listButton('Favorito'));

    expect(await screen.findByRole('link', { name: 'Entre' })).toBeInTheDocument();
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
  });

  it('a mudança invalida as recomendações, para a próxima lista já sair com ela', async () => {
    stubLibrary({ rating: null, lists: [] }, () => Response.json({ lists: ['FAVORITE'] }));
    const { queryClient } = renderControls();
    queryClient.setQueryData(RECOMMENDATIONS_QUERY_KEY, { items: [] });

    await userEvent.click(await listButton('Favorito'));

    await waitFor(() =>
      expect(queryClient.getQueryState(RECOMMENDATIONS_QUERY_KEY)?.isInvalidated).toBe(true),
    );
  });
});
