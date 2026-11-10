import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { SiteHeader } from './site-header';

vi.mock('next/navigation', () => ({ usePathname: () => '/catalogo' }));

const MAIN_LINKS = [
  ['Catálogo', '/catalogo'],
  ['Coleções', '/colecoes'],
  ['Recomendações', '/recomendacoes'],
];

const mainLinks = () =>
  within(screen.getByRole('navigation', { name: 'Principal' }))
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')]);

describe('SiteHeader', () => {
  it('sem sessão, traz o início, os links principais e os de entrar e criar conta', async () => {
    stubFetch(() => apiError(401, 'Sessão ausente ou expirada'));

    renderWithQuery(<SiteHeader />);

    expect(screen.getByRole('link', { name: 'Indie Discovery' })).toHaveAttribute('href', '/');
    expect(mainLinks()).toEqual(MAIN_LINKS);
    const account = await screen.findByRole('navigation', { name: 'Conta' });
    expect(within(account).getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/entrar?next=%2Fcatalogo',
    );
    expect(within(account).getByRole('link', { name: 'Criar conta' })).toBeInTheDocument();
  });

  it('com sessão, traz os mesmos links principais, o nome e o botão de sair', async () => {
    stubFetch(() => Response.json({ ...sampleUser, displayName: 'Jogadora de Teste' }));

    renderWithQuery(<SiteHeader />);

    expect(await screen.findByText('Jogadora de Teste')).toHaveAttribute(
      'title',
      'Jogadora de Teste',
    );
    expect(mainLinks()).toEqual(MAIN_LINKS);
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });
});
