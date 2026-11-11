import type { FeatureOption, GameSummary, PreferenceOptions, Preferences } from '@indie/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sampleGame } from '@/test/catalog';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { OnboardingView } from './onboarding-view';

const RATED_AT = '2026-11-11T12:00:00.000Z';

const option = (slug: string, name: string, gameCount = 10, aliases?: string[]): FeatureOption => ({
  slug,
  name,
  gameCount,
  ...(aliases && { aliases }),
});

// 30 etiquetas, da Etiqueta 01 (mais frequente) à Etiqueta 30, e a Difícil, a menos frequente.
const TAGS = [
  ...Array.from({ length: 30 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return option(`etiqueta-${n}`, `Etiqueta ${n}`, 1000 - i);
  }),
  option('difficult', 'Difícil', 5, ['Impiedoso']),
];

const OPTIONS: PreferenceOptions = {
  genres: [option('platform', 'Plataforma'), option('puzzle', 'Quebra-cabeça')],
  themes: [option('horror', 'Terror')],
  tags: TAGS,
};

const NO_PREFERENCES: Preferences = { genres: [], themes: [], tags: [] };

const games = (count: number): GameSummary[] =>
  Array.from({ length: count }, (_, i) =>
    sampleGame({ slug: `jogo-${i + 1}`, name: `Jogo ${i + 1}` }),
  );

// Uma API com a sessão, as opções e as preferências; as notas respondem conforme o método.
function stubOnboarding({
  preferences = NO_PREFERENCES,
  onboardingGames = () => Response.json({ items: games(14) }),
}: {
  preferences?: Preferences;
  onboardingGames?: () => Response;
} = {}) {
  return stubFetch((path, method) => {
    if (path === '/api/auth/me') return Response.json(sampleUser);
    if (path === '/api/me/preferences/options') return Response.json(OPTIONS);
    if (path === '/api/me/preferences' && method === 'GET') return Response.json(preferences);
    if (path === '/api/me/preferences' && method === 'PUT') {
      return Response.json({
        genres: [{ slug: 'puzzle', name: 'Quebra-cabeça' }],
        themes: [{ slug: 'horror', name: 'Terror' }],
        tags: [{ slug: 'difficult', name: 'Difícil' }],
      });
    }
    if (path === '/api/me/onboarding/games') return onboardingGames();
    if (path.startsWith('/api/me/ratings/') && method === 'PUT') {
      return Response.json({ score: 5, updatedAt: RATED_AT });
    }
    return new Response(null, { status: 204 });
  });
}

const renderOnboarding = (next = '/recomendacoes') =>
  renderWithQuery(<OnboardingView next={next} />);

const check = (name: string) => userEvent.click(screen.getByRole('checkbox', { name }));

async function choosePreferences() {
  await screen.findByRole('group', { name: 'Gêneros' });
  await check('Quebra-cabeça');
  await check('Terror');
  await userEvent.type(screen.getByLabelText('Buscar etiqueta'), 'impiedoso');
  await check('Difícil');
  await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
}

const rate = (game: string, score: number) =>
  userEvent.click(
    within(screen.getByRole('group', { name: `Sua nota para ${game}` })).getByRole('button', {
      name: String(score),
    }),
  );

describe('OnboardingView', () => {
  it('sem sessão, convida a entrar e volta para a partida a frio', async () => {
    stubFetch(() => apiError(401, 'Sessão ausente ou expirada'));
    renderOnboarding();

    expect(await screen.findByRole('link', { name: 'Entre' })).toHaveAttribute(
      'href',
      '/entrar?next=%2Fboas-vindas%3Fnext%3D%252Frecomendacoes',
    );
    expect(screen.getByText(/para escolher seus gostos/)).toBeInTheDocument();
  });

  it('recusa menos de 3 escolhas sem chamar a API', async () => {
    const fetchMock = stubOnboarding();
    renderOnboarding();

    await screen.findByRole('group', { name: 'Gêneros' });
    await check('Terror');
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Escolha pelo menos 3 gêneros, temas ou etiquetas.',
    );
    expect(screen.getByText('1 escolhido (mínimo 3)')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toEqual([]);

    await check('Quebra-cabeça');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('grava os três grupos e segue para a etapa das notas', async () => {
    const fetchMock = stubOnboarding();
    renderOnboarding();

    await choosePreferences();

    expect(await screen.findByRole('heading', { name: /Avalie até 4 jogos/ })).toHaveFocus();
    expect(screen.getByText('Etapa 2 de 2')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(
      ([path, init]) => path === '/api/me/preferences' && init?.method === 'PUT',
    );
    expect(JSON.parse(put?.[1]?.body as string)).toEqual({
      genres: ['puzzle'],
      themes: ['horror'],
      tags: ['difficult'],
    });
  });

  it('"Agora não" sai sem gravar, para o destino', async () => {
    stubOnboarding();
    renderOnboarding('/jogos/celeste');

    expect(await screen.findByRole('link', { name: 'Agora não' })).toHaveAttribute(
      'href',
      '/jogos/celeste',
    );
  });

  describe('etiquetas', () => {
    it('mostra de início as 24 mais frequentes, e "Ver todas" mostra o resto', async () => {
      stubOnboarding();
      renderOnboarding();

      const group = await screen.findByRole('group', { name: 'Etiquetas da comunidade Steam' });
      expect(within(group).getAllByRole('checkbox')).toHaveLength(24);
      expect(
        within(group).queryByRole('checkbox', { name: 'Etiqueta 25' }),
      ).not.toBeInTheDocument();

      await userEvent.click(within(group).getByRole('button', { name: 'Ver todas (31)' }));

      expect(within(group).getAllByRole('checkbox')).toHaveLength(31);
      expect(within(group).queryByRole('button', { name: /Ver todas/ })).not.toBeInTheDocument();
    });

    it('a busca procura em todas, também pelo nome de antes, sem acento', async () => {
      stubOnboarding();
      renderOnboarding();

      const group = await screen.findByRole('group', { name: 'Etiquetas da comunidade Steam' });
      await userEvent.type(within(group).getByLabelText('Buscar etiqueta'), 'dificil');
      expect(
        within(group)
          .getAllByRole('checkbox')
          .map((box) => box.closest('label')?.textContent),
      ).toEqual(['Difícil']);

      await userEvent.clear(within(group).getByLabelText('Buscar etiqueta'));
      await userEvent.type(within(group).getByLabelText('Buscar etiqueta'), 'nada assim');
      expect(within(group).getByText('Nenhuma etiqueta com esse nome.')).toBeInTheDocument();
    });

    it('ao refazer, vem com as escolhas gravadas, também a etiqueta fora das 24', async () => {
      stubOnboarding({
        preferences: {
          genres: [{ slug: 'puzzle', name: 'Quebra-cabeça' }],
          themes: [],
          tags: [{ slug: 'difficult', name: 'Difícil' }],
        },
      });
      renderOnboarding();

      expect(await screen.findByRole('checkbox', { name: 'Difícil' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Quebra-cabeça' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Terror' })).not.toBeChecked();
      expect(screen.getByText('2 escolhidos (mínimo 3)')).toBeInTheDocument();
    });
  });

  describe('etapa das notas', () => {
    async function toRatings(options: Parameters<typeof stubOnboarding>[0] = {}) {
      const fetchMock = stubOnboarding(options);
      renderOnboarding();
      await choosePreferences();
      await screen.findByRole('heading', { name: /Avalie até 4 jogos/ });
      return fetchMock;
    }

    it('mostra 12 jogos e mais 12 a cada clique, e "Pular" leva ao destino', async () => {
      await toRatings();

      expect(await screen.findAllByRole('article')).toHaveLength(12);
      expect(screen.getByRole('link', { name: 'Pular' })).toHaveAttribute('href', '/recomendacoes');

      await userEvent.click(screen.getByRole('button', { name: 'Mostrar mais jogos' }));

      expect(screen.getAllByRole('article')).toHaveLength(14);
      expect(screen.queryByRole('button', { name: 'Mostrar mais jogos' })).not.toBeInTheDocument();
    });

    it('aceita até 4 notas; removida uma, os outros jogos voltam a aceitar', async () => {
      const fetchMock = await toRatings();
      await screen.findAllByRole('article');

      for (const game of ['Jogo 1', 'Jogo 2', 'Jogo 3', 'Jogo 4']) await rate(game, 5);

      await waitFor(() =>
        expect(screen.getByText(/4 de 4 avaliados\. Para avaliar outro/)).toBeInTheDocument(),
      );
      const fifth = within(screen.getByRole('group', { name: 'Sua nota para Jogo 5' }));
      expect(fifth.getByRole('button', { name: '5' })).toBeDisabled();
      expect(screen.getByRole('link', { name: 'Concluir' })).toHaveAttribute(
        'href',
        '/recomendacoes',
      );
      expect(fetchMock).toHaveBeenCalledWith('/api/me/ratings/jogo-4', expect.anything());

      await userEvent.click(
        within(screen.getByRole('group', { name: 'Sua nota para Jogo 2' })).getByRole('button', {
          name: 'Remover nota',
        }),
      );

      await waitFor(() => expect(screen.getByText('3 de 4 avaliados')).toBeInTheDocument());
      expect(fifth.getByRole('button', { name: '5' })).toBeEnabled();
    });

    it('sem jogos para avaliar, diz por quê e deixa concluir', async () => {
      await toRatings({ onboardingGames: () => Response.json({ items: [] }) });

      expect(
        await screen.findByText(/Não encontramos jogos lançados com esses gostos/),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Pular' })).toBeInTheDocument();
    });

    it('com erro ao carregar os jogos, mostra a mensagem e deixa tentar de novo ou pular', async () => {
      await toRatings({ onboardingGames: () => apiError(503, 'Tente de novo em instantes.') });

      expect(await screen.findByText('Tente de novo em instantes.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Pular' })).toBeInTheDocument();
    });
  });
});
