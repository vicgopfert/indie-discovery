import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { CONFIRMATION_SENT_MESSAGE, EmailConfirmationBanner } from './email-confirmation-banner';
import { SESSION_QUERY_KEY } from './hooks';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

beforeEach(() => {
  navigation.pathname = '/';
});

const unconfirmed = { ...sampleUser, emailConfirmedAt: null };

// A sessão responde `user`; o reenvio, `resend`.
function renderBanner(
  user: typeof sampleUser | null,
  resend = () => new Response(null, { status: 202 }),
) {
  const fetchMock = stubFetch((path) => {
    if (path !== '/api/auth/me') return resend();
    return user ? Response.json(user) : apiError(401, 'Sessão ausente ou expirada');
  });
  return { ...renderWithQuery(<EmailConfirmationBanner />), fetchMock };
}

const banner = () => screen.queryByRole('region', { name: 'Confirmação do e-mail' });
const resendButton = () => screen.findByRole('button', { name: 'Reenviar e-mail' });

describe('EmailConfirmationBanner', () => {
  it('mostra o endereço cadastrado para quem não confirmou', async () => {
    renderBanner(unconfirmed);

    await resendButton();
    expect(banner()).toHaveTextContent(
      'Confirme o seu e-mail, jogadora@example.com, pelo link de confirmação.',
    );
  });

  it.each([
    ['sem sessão', null],
    ['com o e-mail confirmado', sampleUser],
  ])('não aparece %s', async (_, user) => {
    const { queryClient } = renderBanner(user);

    await vi.waitFor(() =>
      expect(queryClient.getQueryState(SESSION_QUERY_KEY)?.status).toBe('success'),
    );
    expect(banner()).not.toBeInTheDocument();
  });

  it('não aparece na própria página de confirmação', async () => {
    navigation.pathname = '/confirmar-email';
    const { queryClient } = renderBanner(unconfirmed);

    await vi.waitFor(() =>
      expect(queryClient.getQueryState(SESSION_QUERY_KEY)?.status).toBe('success'),
    );
    expect(banner()).not.toBeInTheDocument();
  });

  it('reenvia o e-mail e avisa que só o link mais recente funciona', async () => {
    const { fetchMock } = renderBanner(unconfirmed);

    await userEvent.setup().click(await resendButton());

    expect(await screen.findByText(CONFIRMATION_SENT_MESSAGE)).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls.at(-1)!;
    expect(path).toBe('/api/auth/email-confirmation/request');
    expect(init?.method).toBe('POST');
  });

  it('acima do limite, mostra a mensagem da API', async () => {
    renderBanner(unconfirmed, () =>
      apiError(429, 'Muitas tentativas; aguarde um pouco e tente de novo'),
    );

    await userEvent.setup().click(await resendButton());

    expect(
      await screen.findByText('Muitas tentativas; aguarde um pouco e tente de novo'),
    ).toBeInTheDocument();
  });

  it('com a sessão vencida, o aviso some', async () => {
    renderBanner(unconfirmed, () => apiError(401, 'Sessão ausente ou expirada'));

    await userEvent.setup().click(await resendButton());

    await vi.waitFor(() => expect(banner()).not.toBeInTheDocument());
  });
});
