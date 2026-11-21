import { INVALID_CONFIRMATION_LINK_MESSAGE } from '@indie/contracts';
import { screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { ConfirmEmailView, MISSING_CONFIRMATION_TOKEN_MESSAGE } from './confirm-email-view';
import { SESSION_QUERY_KEY } from './hooks';

const TOKEN = 'token-do-link_123';

function openLink(hash: string) {
  window.history.replaceState(null, '', `/confirmar-email${hash}`);
}

afterEach(() => window.history.replaceState(null, '', '/'));

const confirmed = () => new Response(null, { status: 204 });

describe('ConfirmEmailView', () => {
  it('confirma ao abrir, com o token depois do #, e o tira do endereço', async () => {
    const fetchMock = stubFetch(confirmed);
    openLink(`#${TOKEN}`);
    renderWithQuery(<ConfirmEmailView />);

    expect(await screen.findByText(/E-mail confirmado\./)).toBeInTheDocument();
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe('/api/auth/email-confirmation/confirm');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ token: TOKEN });
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/confirmar-email');
  });

  it('envia o token uma vez só, mesmo com o efeito rodando duas vezes', async () => {
    const fetchMock = stubFetch(confirmed);
    openLink(`#${TOKEN}`);
    renderWithQuery(
      <StrictMode>
        <ConfirmEmailView />
      </StrictMode>,
    );

    await screen.findByText(/E-mail confirmado\./);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('depois de confirmar, oferece a redefinição de senha e o início', async () => {
    stubFetch(confirmed);
    openLink(`#${TOKEN}`);
    renderWithQuery(<ConfirmEmailView />);

    expect(await screen.findByRole('link', { name: 'Pedir a redefinição' })).toHaveAttribute(
      'href',
      '/esqueci-senha',
    );
    expect(screen.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/');
  });

  it('recarrega a sessão, para o aviso sumir se a conta estiver aberta', async () => {
    stubFetch((path) => (path === '/api/auth/me' ? Response.json(sampleUser) : confirmed()));
    openLink(`#${TOKEN}`);
    const { queryClient } = renderWithQuery(<ConfirmEmailView />);
    queryClient.setQueryData(SESSION_QUERY_KEY, { ...sampleUser, emailConfirmedAt: null });

    await screen.findByText(/E-mail confirmado\./);

    expect(queryClient.getQueryState(SESSION_QUERY_KEY)?.isInvalidated).toBe(true);
  });

  it('link vencido ou usado mostra a mensagem da API', async () => {
    stubFetch(() => apiError(400, INVALID_CONFIRMATION_LINK_MESSAGE));
    openLink(`#${TOKEN}`);
    renderWithQuery(<ConfirmEmailView />);

    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_CONFIRMATION_LINK_MESSAGE);
  });

  it('sem token no endereço, pede para abrir de novo o link e não chama a API', async () => {
    const fetchMock = stubFetch(confirmed);
    openLink('');
    renderWithQuery(<ConfirmEmailView />);

    expect(await screen.findByRole('alert')).toHaveTextContent(MISSING_CONFIRMATION_TOKEN_MESSAGE);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('o link colado na mesma aba, que só muda o #, confirma', async () => {
    stubFetch(confirmed);
    openLink('');
    renderWithQuery(<ConfirmEmailView />);
    await screen.findByRole('alert');

    window.location.hash = `#${TOKEN}`;

    expect(await screen.findByText(/E-mail confirmado\./)).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(''));
  });
});
