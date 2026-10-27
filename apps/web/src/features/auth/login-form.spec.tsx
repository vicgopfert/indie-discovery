import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { SESSION_QUERY_KEY } from './hooks';
import { LoginForm } from './login-form';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => router.replace.mockReset());

async function submit(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText('E-mail'), email);
  if (password) await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

describe('LoginForm', () => {
  it('valida os campos sem chamar a API', async () => {
    const fetchMock = stubFetch(() => Response.json(sampleUser));
    renderWithQuery(<LoginForm redirectTo="/" />);

    await submit('não-é-email', '');

    expect(await screen.findByLabelText('E-mail')).toHaveAccessibleDescription('E-mail inválido.');
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription('Informe a senha.');
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('entra com o e-mail normalizado, guarda a sessão e segue para o destino', async () => {
    const fetchMock = stubFetch(() => Response.json(sampleUser));
    const { queryClient } = renderWithQuery(<LoginForm redirectTo="/catalogo" />);

    await submit(' Jogadora@Example.com ', 'senha-forte');

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/catalogo'));
    const body = fetchMock.mock.calls[0]?.[1]?.body as string;
    expect(JSON.parse(body)).toEqual({ email: 'jogadora@example.com', password: 'senha-forte' });
    expect(queryClient.getQueryData(SESSION_QUERY_KEY)).toEqual(sampleUser);
  });

  it.each([
    [401, 'E-mail ou senha incorretos'],
    [429, 'Muitas tentativas; aguarde um pouco e tente de novo'],
  ])('mostra o erro %i no topo, sem apontar um campo', async (status, message) => {
    stubFetch(() => apiError(status, message));
    renderWithQuery(<LoginForm redirectTo="/" />);

    await submit('jogadora@example.com', 'senha-errada');

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'false');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('API fora do ar vira a mensagem genérica', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    renderWithQuery(<LoginForm redirectTo="/" />);

    await submit('jogadora@example.com', 'senha-forte');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível falar com o servidor',
    );
  });
});
