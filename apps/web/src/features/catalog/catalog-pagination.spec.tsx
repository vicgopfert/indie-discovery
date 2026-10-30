import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CatalogPagination } from './catalog-pagination';
import { parseCatalogParams } from './search-params';

function renderPagination(params: Record<string, string>, totalPages: number) {
  const parsed = parseCatalogParams(params);
  if (!parsed.ok) throw new Error(parsed.errors.join(' '));
  return render(<CatalogPagination query={parsed.query} totalPages={totalPages} />);
}

describe('CatalogPagination', () => {
  it('no meio, liga para a anterior e a próxima mantendo os filtros', () => {
    renderPagination({ genre: 'puzzle', page: '2' }, 5);

    expect(screen.getByText('Página 2 de 5')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      '/catalogo?genre=puzzle',
    );
    expect(screen.getByRole('link', { name: 'Próxima' })).toHaveAttribute(
      'href',
      '/catalogo?genre=puzzle&page=3',
    );
  });

  it('na primeira e na última, some o link que não leva a lugar nenhum', () => {
    const { unmount } = renderPagination({}, 3);
    expect(screen.queryByRole('link', { name: 'Anterior' })).not.toBeInTheDocument();
    unmount();

    renderPagination({ page: '3' }, 3);
    expect(screen.queryByRole('link', { name: 'Próxima' })).not.toBeInTheDocument();
  });

  it('com uma página só, não aparece', () => {
    renderPagination({}, 1);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });
});
