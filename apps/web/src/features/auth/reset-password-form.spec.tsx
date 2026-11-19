import { INVALID_RESET_LINK_MESSAGE } from '@indie/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { SESSION_QUERY_KEY } from './hooks';
import {
  MISSING_RESET_TOKEN_MESSAGE,
  PASSWORD_RESET_DONE_PATH,
  ResetPasswordForm,
} from './reset-password-form';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const TOKEN = 'token-do-link_123';

function openLink(hash: string) {
  window.history.replaceState(null, '', `/redefinir-senha${hash}`);
}

beforeEach(() => router.replace.mockReset());
afterEach(() => window.history.replaceState(null, '', '/'));

async function submit(password: string) {
  const user = userEvent.setup();
  if (password) await user.type(await screen.findByLabelText('Nova senha'), password);
  await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));
}

describe('ResetPasswordForm', () => {
  it('lê o token depois do # e o tira do endereço', async () => {
    openLink(`#${TOKEN}`);
    renderWithQuery(<ResetPasswordForm />);

    expect(await screen.findByLabelText('Nova senha')).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(window.location.pathname).toBe('/redefinir-senha');
  });

  it('sem token no endereço, pede para abrir de novo o link do e-mail e não mostra o formulário', async () => {
    openLink('');
    renderWithQuery(<ResetPasswordForm />);

    expect(await screen.findByRole('alert')).toHaveTextContent(MISSING_RESET_TOKEN_MESSAGE);
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });

  it('o link colado na mesma aba, que só muda o #, mostra o formulário', async () => {
    openLink('');
    renderWithQuery(<ResetPasswordForm />);
    await screen.findByRole('alert');

    window.location.hash = `#${TOKEN}`;

    expect(await screen.findByLabelText('Nova senha')).toBeInTheDocument();
    await waitFor(() => expect(window.location.hash).toBe(''));
  });

  it('valida a senha nova pela regra do cadastro, sem chamar a API', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    openLink(`#${TOKEN}`);
    renderWithQuery(<ResetPasswordForm />);

    await submit('1234567');

    expect(await screen.findByLabelText('Nova senha')).toHaveAccessibleDescription(
      /A senha tem no mínimo 8 caracteres\./,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia o token com a senha nova, limpa a conta do cache e leva ao login', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    openLink(`#${TOKEN}`);
    const { queryClient } = renderWithQuery(<ResetPasswordForm />);
    queryClient.setQueryData(SESSION_QUERY_KEY, sampleUser);

    await submit('senha-nova-forte');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(PASSWORD_RESET_DONE_PATH));
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe('/api/auth/password-reset/confirm');
    expect(JSON.parse(init?.body as string)).toEqual({
      token: TOKEN,
      password: 'senha-nova-forte',
    });
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toBeNull();
  });

  it('link vencido ou usado mostra a mensagem da API no topo', async () => {
    stubFetch(() => apiError(400, INVALID_RESET_LINK_MESSAGE));
    openLink(`#${TOKEN}`);
    renderWithQuery(<ResetPasswordForm />);

    await submit('senha-nova-forte');

    expect(await screen.findByRole('alert')).toHaveTextContent(INVALID_RESET_LINK_MESSAGE);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('usa o campo de senha com o botão de mostrar e o preenchimento de senha nova', async () => {
    openLink(`#${TOKEN}`);
    renderWithQuery(<ResetPasswordForm />);

    const field = await screen.findByLabelText('Nova senha');

    expect(field).toHaveAttribute('type', 'password');
    expect(field).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByRole('button', { name: 'Mostrar senha' })).toBeInTheDocument();
  });
});
