import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { renderWithQuery } from '@/test/render';
import { UserMenu } from './user-menu';

const navigation = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => navigation.pathname }));

beforeEach(() => {
  navigation.pathname = '/';
});

const guest = () => apiError(401, 'Sessão ausente ou expirada');

describe('UserMenu', () => {
  it('não mostra "Entrar" enquanto a sessão carrega', () => {
    stubFetch(() => Response.json(sampleUser));
    renderWithQuery(<UserMenu />);

    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
  });

  it('sem sessão, oferece entrar e criar conta, voltando para a página atual', async () => {
    navigation.pathname = '/catalogo';
    stubFetch(guest);
    renderWithQuery(<UserMenu />);

    expect(await screen.findByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/entrar?next=%2Fcatalogo',
    );
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/cadastrar?next=%2Fcatalogo',
    );
  });

  it('nas páginas de conta, os links não apontam de volta para elas', async () => {
    navigation.pathname = '/entrar';
    stubFetch(guest);
    renderWithQuery(<UserMenu />);

    expect(await screen.findByRole('link', { name: 'Criar conta' })).toHaveAttribute(
      'href',
      '/cadastrar',
    );
  });

  it('com sessão, mostra o nome; sair encerra a sessão na API e volta aos links', async () => {
    const fetchMock = stubFetch((path) =>
      path === '/api/auth/logout' ? new Response(null, { status: 204 }) : Response.json(sampleUser),
    );
    renderWithQuery(<UserMenu />);

    expect(await screen.findByText('Jogadora')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/logout',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sessão que já venceu no servidor também termina sem sessão', async () => {
    stubFetch((path) => (path === '/api/auth/logout' ? guest() : Response.json(sampleUser)));
    renderWithQuery(<UserMenu />);

    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('se a API não responder ao sair, avisa e mantém a sessão', async () => {
    stubFetch((path) => {
      if (path === '/api/auth/logout') throw new TypeError('Failed to fetch');
      return Response.json(sampleUser);
    });
    renderWithQuery(<UserMenu />);

    await userEvent.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível sair');
    expect(screen.getByText('Jogadora')).toBeInTheDocument();
  });
});
