import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { GuestOnly } from './guest-only';

describe('GuestOnly', () => {
  it('sem sessão, mostra o conteúdo', async () => {
    stubFetch(() => apiError(401, 'Sessão ausente ou expirada'));
    renderWithQuery(<GuestOnly>formulário</GuestOnly>);

    expect(await screen.findByText('formulário')).toBeInTheDocument();
  });

  it('com sessão, avisa quem já entrou no lugar do conteúdo', async () => {
    stubFetch(() => Response.json(sampleUser));
    renderWithQuery(<GuestOnly>formulário</GuestOnly>);

    expect(await screen.findByText('Jogadora')).toBeInTheDocument();
    expect(screen.queryByText('formulário')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir para o início' })).toHaveAttribute('href', '/');
  });
});
