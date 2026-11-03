import type { RecommendationList } from '@indie/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sampleGame } from '@/test/catalog';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { sampleRecommendation, sampleRecommendationList } from '@/test/recommendations';
import { renderWithQuery } from '@/test/render';
import { RecommendationsView } from './recommendations-view';

const BALANCED = '/api/recommendations?mode=balanced';
const DISCOVERY = '/api/recommendations?mode=discovery';

const discoveryList = sampleRecommendationList({
  mode: 'DISCOVERY',
  items: [
    sampleRecommendation({
      game: sampleGame({ slug: 'lavaloop', name: 'Lavaloop' }),
      lowKnown: true,
    }),
  ],
});

// Uma API com a sessão no modo Equilibrado; `reply` responde o resto.
function stubRecommendations(reply: (path: string, method: string) => Response) {
  return stubFetch((path, method) =>
    path === '/api/auth/me' ? Response.json(sampleUser) : reply(path, method),
  );
}

const stubList = (list: RecommendationList) => stubRecommendations(() => Response.json(list));

const modeButton = (name: string) => screen.findByRole('button', { name });

describe('RecommendationsView', () => {
  it('sem sessão, convida a entrar e volta para as recomendações', async () => {
    stubFetch(() => apiError(401, 'Sessão ausente ou expirada'));
    renderWithQuery(<RecommendationsView />);

    expect(await screen.findByRole('link', { name: 'Entre' })).toHaveAttribute(
      'href',
      '/entrar?next=%2Frecomendacoes',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('mostra a lista do modo salvo, com o seletor nesse modo', async () => {
    const fetchMock = stubList(sampleRecommendationList());
    renderWithQuery(<RecommendationsView />);

    expect(await screen.findByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(BALANCED, expect.anything());
    expect(await modeButton('Equilibrado')).toHaveAttribute('aria-pressed', 'true');
    expect(await modeButton('Descobertas')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/o jogo entrou na lista por ser menos popular/)).toBeNull();
  });

  it('trocar o modo grava a escolha e depois traz a lista do modo novo', async () => {
    const fetchMock = stubRecommendations((path, method) => {
      if (method === 'PATCH') return Response.json({ ...sampleUser, discoveryMode: 'DISCOVERY' });
      return Response.json(path === DISCOVERY ? discoveryList : sampleRecommendationList());
    });
    renderWithQuery(<RecommendationsView />);

    await userEvent.click(await modeButton('Descobertas'));

    expect(await screen.findByRole('link', { name: 'Lavaloop' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Celeste' })).not.toBeInTheDocument();
    expect(await modeButton('Descobertas')).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText('Pouco conhecido: o jogo entrou na lista por ser menos popular.'),
    ).toBeInTheDocument();

    const calls = fetchMock.mock.calls.map(([path, init]) => `${init?.method ?? 'GET'} ${path}`);
    const patch = calls.indexOf('PATCH /api/me');
    expect(fetchMock.mock.calls[patch]?.[1]?.body).toBe(
      JSON.stringify({ discoveryMode: 'DISCOVERY' }),
    );
    expect(calls.indexOf(`GET ${DISCOVERY}`)).toBeGreaterThan(patch);
  });

  it('se gravar o modo falhar, avisa e mantém o modo e a lista', async () => {
    const fetchMock = stubRecommendations((path, method) =>
      method === 'PATCH'
        ? apiError(500, 'Erro interno no servidor.')
        : Response.json(sampleRecommendationList()),
    );
    renderWithQuery(<RecommendationsView />);

    await userEvent.click(await modeButton('Descobertas'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno no servidor.');
    expect(await modeButton('Equilibrado')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(DISCOVERY, expect.anything());
  });

  it('sem avaliações, listas nem preferências, orienta a avaliar, sem o seletor', async () => {
    stubList(sampleRecommendationList({ basis: 'empty', items: [] }));
    renderWithQuery(<RecommendationsView />);

    expect(
      await screen.findByText(/Avalie alguns jogos ou guarde nas suas listas/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver o catálogo' })).toHaveAttribute(
      'href',
      '/catalogo',
    );
    expect(screen.queryByRole('group', { name: 'Modo de descoberta' })).not.toBeInTheDocument();
  });

  it('com a lista de populares, explica por quê, sem o seletor', async () => {
    stubList(
      sampleRecommendationList({
        basis: 'popular',
        items: [sampleRecommendation({ reason: null })],
      }),
    );
    renderWithQuery(<RecommendationsView />);

    expect(
      await screen.findByText(/Suas notas ainda não mostram do que você gosta/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Modo de descoberta' })).not.toBeInTheDocument();
  });

  it('com o índice indisponível, mostra a mensagem da API e tenta de novo', async () => {
    let unavailable = true;
    stubRecommendations(() =>
      unavailable
        ? apiError(
            503,
            'As recomendações ainda não estão disponíveis; tente novamente em alguns instantes.',
          )
        : Response.json(sampleRecommendationList()),
    );
    renderWithQuery(<RecommendationsView />);

    expect(
      await screen.findByText(/As recomendações ainda não estão disponíveis/),
    ).toBeInTheDocument();

    unavailable = false;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('link', { name: 'Celeste' })).toBeInTheDocument();
  });

  it('com a sessão vencida, volta ao convite para entrar', async () => {
    stubRecommendations(() => apiError(401, 'Sessão ausente ou expirada'));
    renderWithQuery(<RecommendationsView />);

    await waitFor(() => expect(screen.getByRole('link', { name: 'Entre' })).toBeInTheDocument());
  });
});
