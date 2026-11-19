import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiError, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { ForgotPasswordForm, RESET_REQUESTED_MESSAGE } from './forgot-password-form';

async function submit(email: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('E-mail'), email);
  await user.click(screen.getByRole('button', { name: 'Enviar link' }));
}

describe('ForgotPasswordForm', () => {
  it('valida o e-mail sem chamar a API', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 202 }));
    renderWithQuery(<ForgotPasswordForm />);

    await submit('não-é-email');

    expect(await screen.findByLabelText('E-mail')).toHaveAccessibleDescription(/E-mail inválido\./);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pede o link com o e-mail normalizado e mostra a mesma mensagem para qualquer e-mail', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 202 }));
    renderWithQuery(<ForgotPasswordForm />);

    await submit(' Jogadora@Example.com ');

    expect(await screen.findByRole('status')).toHaveTextContent(RESET_REQUESTED_MESSAGE);
    const [path, init] = fetchMock.mock.calls[0]!;
    expect(path).toBe('/api/auth/password-reset/request');
    expect(JSON.parse(init?.body as string)).toEqual({ email: 'jogadora@example.com' });
    expect(screen.queryByRole('button', { name: 'Enviar link' })).not.toBeInTheDocument();
  });

  it('mostra o limite de pedidos no topo e mantém o formulário', async () => {
    const message = 'Muitas tentativas; aguarde um pouco e tente de novo';
    stubFetch(() => apiError(429, message));
    renderWithQuery(<ForgotPasswordForm />);

    await submit('jogadora@example.com');

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Enviar link' })).toBeInTheDocument();
  });
});
