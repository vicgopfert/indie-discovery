import type { RecommendationPage } from '@indie/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleGame } from '@/test/catalog';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { sampleRecommendation, sampleRecommendationPage } from '@/test/recommendations';
import { renderWithQuery } from '@/test/render';
import { RecommendationListView } from './recommendation-list-view';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => router.replace.mockReset());

const HORROR = '/api/recommendations/lists/theme%3Ahorror';

// Uma API com a sessão no modo Equilibrado; `reply` responde o resto.
function stubList(reply: (path: string, method: string) => Response) {
  return stubFetch((path, method) =>
    path === '/api/auth/me' ? Response.json(sampleUser) : reply(path, method),
  );
}

const stubPage = (page: RecommendationPage) => stubList(() => Response.json(page));

const renderList = (page = 1, listKey = 'theme:horror') =>
  renderWithQuery(<RecommendationListView listKey={listKey} page={page} />);

describe('RecommendationListView', () => {
  it('sem sessão, convida a entrar e volta para a mesma página da lista', async () => {
    stubFetch(() => apiError(401, 'Sessão ausente ou expirada'));
    renderList(2);

    expect(await screen.findByRole('link', { name: 'Entre' })).toHaveAttribute(
      'href',
      '/entrar?next=%2Frecomendacoes%2Ftema-horror%3Fpage%3D2',
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Recomendações');
    expect(screen.getByRole('link', { name: 'Voltar às recomendações' })).toHaveAttribute(
      'href',
      '/recomendacoes',
    );
  });

  it('mostra a primeira página com o título da prateleira e o link para a próxima', async () => {
    const fetchMock = stubPage(sampleRecommendationPage({ hasMore: true }));
    renderList();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Porque você curte Terror' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Celeste' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(`${HORROR}?mode=balanced&page=1`, expect.anything());
    expect(screen.getByText('Página 1')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Anterior' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Próxima' })).toHaveAttribute(
      'href',
      '/recomendacoes/tema-horror?page=2',
    );
    expect(await screen.findByRole('button', { name: 'Equilibrado' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('a prateleira por jogo tem o nome do jogo de origem no título', async () => {
    stubPage(
      sampleRecommendationPage({
        key: 'game:hollow-knight',
        feature: null,
        game: { slug: 'hollow-knight', name: 'Hollow Knight', inCatalog: true },
      }),
    );
    renderList(1, 'game:hollow-knight');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Porque você gostou de Hollow Knight' }),
    ).toBeInTheDocument();
  });

  it('no meio, liga para a anterior e a próxima; na última, só para a anterior', async () => {
    stubList((path) =>
      Response.json(
        sampleRecommendationPage(
          path.endsWith('page=2') ? { page: 2, hasMore: true } : { page: 3, hasMore: false },
        ),
      ),
    );
    const { unmount } = renderList(2);

    expect(await screen.findByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      '/recomendacoes/tema-horror',
    );
    expect(screen.getByRole('link', { name: 'Próxima' })).toHaveAttribute(
      'href',
      '/recomendacoes/tema-horror?page=3',
    );
    unmount();

    renderList(3);
    expect(await screen.findByText('Página 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      '/recomendacoes/tema-horror?page=2',
    );
    expect(screen.queryByRole('link', { name: 'Próxima' })).not.toBeInTheDocument();
  });

  it('com uma página só, não mostra a paginação', async () => {
    stubPage(sampleRecommendationPage());
    renderList();

    expect(await screen.findByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument();
  });

  it('a lista que deixou de existir volta à visão geral, sem mostrar erro', async () => {
    stubList(() => apiError(404, 'Lista não encontrada.'));
    renderList();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/recomendacoes'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Lista não encontrada.')).not.toBeInTheDocument();
  });

  it('trocar o modo grava a escolha, traz a lista do modo novo e volta à primeira página', async () => {
    const lavaloop = sampleRecommendation({
      game: sampleGame({ slug: 'lavaloop', name: 'Lavaloop' }),
      lowKnown: true,
    });
    const fetchMock = stubList((path, method) => {
      if (method === 'PATCH') return Response.json({ ...sampleUser, discoveryMode: 'DISCOVERY' });
      return Response.json(
        path.includes('mode=discovery')
          ? sampleRecommendationPage({ mode: 'DISCOVERY', page: 3, items: [lavaloop] })
          : sampleRecommendationPage({ page: 3 }),
      );
    });
    renderList(3);

    await userEvent.click(await screen.findByRole('button', { name: 'Descobertas' }));

    expect(await screen.findByRole('link', { name: 'Lavaloop' })).toBeInTheDocument();
    expect(
      screen.getByText('Pouco conhecido: o jogo entrou na lista por ser menos popular.'),
    ).toBeInTheDocument();
    expect(router.replace).toHaveBeenCalledWith('/recomendacoes/tema-horror');

    const calls = fetchMock.mock.calls.map(([path, init]) => `${init?.method ?? 'GET'} ${path}`);
    expect(calls.indexOf(`GET ${HORROR}?mode=discovery&page=3`)).toBeGreaterThan(
      calls.indexOf('PATCH /api/me'),
    );
  });

  it('na lista de populares, explica por quê, sem o seletor', async () => {
    stubPage(
      sampleRecommendationPage({
        basis: 'popular',
        key: 'main',
        feature: null,
        items: [sampleRecommendation({ reason: null })],
      }),
    );
    renderList(1, 'main');

    expect(
      await screen.findByText(/Suas notas ainda não mostram do que você gosta/),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Para você');
    expect(screen.queryByRole('group', { name: 'Modo de descoberta' })).not.toBeInTheDocument();
  });

  it('sem perfil, orienta a avaliar jogos', async () => {
    stubPage(sampleRecommendationPage({ basis: 'empty', key: 'main', feature: null, items: [] }));
    renderList(1, 'main');

    expect(
      await screen.findByText(/Avalie alguns jogos ou guarde nas suas listas/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Modo de descoberta' })).not.toBeInTheDocument();
  });

  it('além do teto da lista, avisa e liga para a primeira página', async () => {
    stubPage(sampleRecommendationPage({ page: 12, items: [] }));
    renderList(12);

    expect(await screen.findByText(/Esta lista não tem mais jogos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para a primeira página' })).toHaveAttribute(
      'href',
      '/recomendacoes/tema-horror',
    );
    expect(screen.queryByRole('navigation', { name: 'Paginação' })).not.toBeInTheDocument();
  });

  it('com o índice indisponível, mostra a mensagem da API e tenta de novo', async () => {
    let unavailable = true;
    stubList(() =>
      unavailable
        ? apiError(
            503,
            'As recomendações ainda não estão disponíveis; tente novamente em alguns instantes.',
          )
        : Response.json(sampleRecommendationPage()),
    );
    renderList();

    expect(
      await screen.findByText(/As recomendações ainda não estão disponíveis/),
    ).toBeInTheDocument();

    unavailable = false;
    await userEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('com a sessão vencida, volta ao convite para entrar', async () => {
    stubList(() => apiError(401, 'Sessão ausente ou expirada'));
    renderList();

    await waitFor(() => expect(screen.getByRole('link', { name: 'Entre' })).toBeInTheDocument());
  });
});
