import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { RegisterForm } from './register-form';

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => router.replace.mockReset());

async function submit(password = 'senha-forte') {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nome de exibição'), 'Jogadora');
  await user.type(screen.getByLabelText('E-mail'), 'jogadora@example.com');
  await user.type(screen.getByLabelText(/^Senha/), password);
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
}

describe('RegisterForm', () => {
  it('mostra o tamanho mínimo da senha e recusa uma curta sem chamar a API', async () => {
    const fetchMock = stubFetch(() => Response.json(sampleUser, { status: 201 }));
    renderWithQuery(<RegisterForm redirectTo="/" />);

    await submit('curta');

    expect(await screen.findByText('A senha tem no mínimo 8 caracteres.')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Senha/)).toHaveAccessibleDescription(
      'Mínimo de 8 caracteres. A senha tem no mínimo 8 caracteres.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cria a conta e segue para o destino', async () => {
    stubFetch(() => Response.json(sampleUser, { status: 201 }));
    renderWithQuery(<RegisterForm redirectTo="/" />);

    await submit();

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/'));
  });

  it('e-mail já cadastrado aparece no campo de e-mail', async () => {
    stubFetch(() => apiError(409, 'E-mail já cadastrado'));
    renderWithQuery(<RegisterForm redirectTo="/" />);

    await submit();

    await waitFor(() =>
      expect(screen.getByLabelText('E-mail')).toHaveAccessibleDescription('E-mail já cadastrado'),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('erros de validação da API vão para os campos', async () => {
    stubFetch(() => apiError(400, ['displayName: Nome recusado.']));
    renderWithQuery(<RegisterForm redirectTo="/" />);

    await submit();

    await waitFor(() =>
      expect(screen.getByLabelText('Nome de exibição')).toHaveAccessibleDescription(
        'Nome recusado.',
      ),
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});
