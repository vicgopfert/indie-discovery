import type { RecommendationOverview } from '@indie/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sampleGame } from '@/test/catalog';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { sampleRecommendation, sampleRecommendationOverview } from '@/test/recommendations';
import { renderWithQuery } from '@/test/render';
import { RecommendationsView } from './recommendations-view';

const BALANCED = '/api/recommendations?mode=balanced';
const DISCOVERY = '/api/recommendations?mode=discovery';

const discoveryList = sampleRecommendationOverview({
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

const stubList = (list: RecommendationOverview) => stubRecommendations(() => Response.json(list));

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
    const fetchMock = stubList(sampleRecommendationOverview());
    renderWithQuery(<RecommendationsView />);

    expect(await screen.findByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(BALANCED, expect.anything());
    expect(await modeButton('Equilibrado')).toHaveAttribute('aria-pressed', 'true');
    expect(await modeButton('Descobertas')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText(/o jogo entrou na lista por ser menos popular/)).toBeNull();
  });

  it('mostra a principal no topo e as prateleiras abaixo, na ordem da API', async () => {
    const game = (slug: string, name: string) =>
      sampleRecommendation({ game: sampleGame({ slug, name }) });
    stubList(
      sampleRecommendationOverview({
        main: { items: [game('celeste', 'Celeste')], hasMore: true },
        shelves: [
          {
            key: 'game:hollow-knight',
            kind: 'liked-game',
            feature: null,
            game: { slug: 'hollow-knight', name: 'Hollow Knight', inCatalog: true },
            items: [game('ori', 'Ori')],
            hasMore: true,
          },
          {
            key: 'theme:horror',
            kind: 'interest',
            feature: { type: 'THEME', slug: 'horror', name: 'Terror', title: 'Terror' },
            items: [game('darkwood', 'Darkwood')],
            hasMore: true,
          },
          {
            key: 'tag:roguelike',
            kind: 'interest',
            feature: {
              type: 'TAG',
              slug: 'roguelike',
              name: 'Roguelike',
              title: 'roguelikes e roguelites',
            },
            items: [game('dead-cells', 'Dead Cells')],
            hasMore: true,
          },
          {
            key: 'upcoming',
            kind: 'upcoming',
            feature: null,
            items: [game('lavaloop', 'Lavaloop')],
            hasMore: false,
          },
        ],
      }),
    );
    renderWithQuery(<RecommendationsView />);

    expect(await screen.findByRole('link', { name: 'Darkwood' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Para você',
      'Porque você gostou de Hollow Knight',
      'Porque você curte Terror',
      'Porque você curte roguelikes e roguelites',
      'Em breve no seu gosto',
    ]);
    const section = (name: string) => screen.getByRole('region', { name });
    expect(
      within(section('Em breve no seu gosto')).getByRole('link', { name: 'Lavaloop' }),
    ).toHaveAttribute('href', '/jogos/lavaloop');
    expect(within(section('Para você')).getByRole('link', { name: 'Celeste' })).toHaveAttribute(
      'title',
      'Celeste',
    );
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();

    expect(
      screen.getAllByRole('link', { name: /^Ver mais/ }).map((a) => a.getAttribute('href')),
    ).toEqual([
      '/recomendacoes/para-voce',
      '/recomendacoes/jogo-hollow-knight',
      '/recomendacoes/tema-horror',
      '/recomendacoes/etiqueta-roguelike',
    ]);
    expect(screen.getByRole('link', { name: 'Ver mais: Porque você curte Terror' })).toBeVisible();
  });

  it('nas prateleiras, mostra só as capas, com o nome no link e no title', async () => {
    const covers = ['Darkwood', 'Inside', 'Limbo', 'Signalis', 'Sem Capa'].map((name, i) =>
      sampleRecommendation({
        game: sampleGame({
          slug: name.toLowerCase().replace(' ', '-'),
          name,
          coverImageId: i === 4 ? '' : `co${i}`,
        }),
        lowKnown: true,
      }),
    );
    stubList(
      sampleRecommendationOverview({
        shelves: [
          {
            key: 'theme:horror',
            kind: 'interest',
            feature: { type: 'THEME', slug: 'horror', name: 'Terror', title: 'Terror' },
            items: covers,
            hasMore: true,
          },
        ],
      }),
    );
    renderWithQuery(<RecommendationsView />);

    const shelf = await screen.findByRole('region', { name: 'Porque você curte Terror' });
    const links = within(shelf).getAllByRole('link', { name: /^(?!Ver mais)/ });
    expect(links.map((a) => a.getAttribute('title'))).toEqual([
      'Darkwood',
      'Inside',
      'Limbo',
      'Signalis',
      'Sem Capa',
    ]);
    expect(within(shelf).queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    expect(within(shelf).queryByText('Pouco conhecido')).not.toBeInTheDocument();
    expect(within(shelf).queryByText(/Recomendado por/)).not.toBeInTheDocument();
    expect(links[4]).toHaveTextContent('Sem Capa');
  });

  it('trocar o modo grava a escolha e depois traz a lista do modo novo', async () => {
    const fetchMock = stubRecommendations((path, method) => {
      if (method === 'PATCH') return Response.json({ ...sampleUser, discoveryMode: 'DISCOVERY' });
      return Response.json(path === DISCOVERY ? discoveryList : sampleRecommendationOverview());
    });
    renderWithQuery(<RecommendationsView />);

    await userEvent.click(await modeButton('Descobertas'));

    expect(await screen.findByRole('link', { name: 'Lavaloop' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Celeste' })).not.toBeInTheDocument();
    expect(await modeButton('Descobertas')).toHaveAttribute('aria-pressed', 'true');
    // Sem cartões na visão geral, não há selo a explicar: a frase fica no "ver mais".
    expect(screen.queryByText(/o jogo entrou na lista por ser menos popular/)).toBeNull();

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
        : Response.json(sampleRecommendationOverview()),
    );
    renderWithQuery(<RecommendationsView />);

    await userEvent.click(await modeButton('Descobertas'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Erro interno no servidor.');
    expect(await modeButton('Equilibrado')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Celeste' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(DISCOVERY, expect.anything());
  });

  it('sem avaliações, listas nem preferências, leva à partida a frio, sem o seletor', async () => {
    stubList(sampleRecommendationOverview({ basis: 'empty', items: [] }));
    renderWithQuery(<RecommendationsView />);

    expect(await screen.findByText(/Conte do que você gosta/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Escolher meus gostos' })).toHaveAttribute(
      'href',
      '/boas-vindas',
    );
    expect(screen.queryByRole('link', { name: 'Mudar meus gostos' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Modo de descoberta' })).not.toBeInTheDocument();
  });

  it('com perfil, oferece mudar os gostos', async () => {
    stubList(sampleRecommendationOverview());
    renderWithQuery(<RecommendationsView />);

    expect(await screen.findByRole('link', { name: 'Mudar meus gostos' })).toHaveAttribute(
      'href',
      '/boas-vindas',
    );
  });

  it('com a lista de populares, explica por quê, sem o seletor', async () => {
    stubList(
      sampleRecommendationOverview({
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
        : Response.json(sampleRecommendationOverview()),
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
