import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogFilters, type CatalogFilterOptions } from './catalog-filters';
import { parseCatalogParams, type CatalogSearchParams } from './search-params';

vi.mock('next/form', () => import('@/test/next-form'));

const options: CatalogFilterOptions = {
  genres: [
    { slug: 'adventure', name: 'Aventura', gameCount: 10922 },
    { slug: 'puzzle', name: 'Quebra-cabeça', gameCount: 3607 },
  ],
  themes: [{ slug: 'horror', name: 'Terror', gameCount: 1500 }],
  countries: [{ code: 'BR', name: 'Brasil', gameCount: 251 }],
};

function renderFilters(params: CatalogSearchParams = {}) {
  const parsed = parseCatalogParams(params);
  if (!parsed.ok) throw new Error(parsed.errors.join(' '));
  return render(<CatalogFilters query={parsed.query} options={options} />);
}

const group = (name: string) => screen.getByRole('group', { name: new RegExp(`^${name}`) });

describe('CatalogFilters', () => {
  it('é um formulário GET para o próprio catálogo', () => {
    const { container } = renderFilters();

    const form = container.querySelector('form');
    expect(form).toHaveAttribute('action', '/catalogo');
    expect(form).not.toHaveAttribute('method');
  });

  it('lista as opções com a contagem de jogos e o país não informado', () => {
    renderFilters();

    expect(
      within(group('Gênero')).getByRole('checkbox', { name: 'Aventura (10.922)' }),
    ).toHaveAttribute('name', 'genre');
    expect(
      within(group('País do estúdio')).getByRole('checkbox', { name: 'Não informado' }),
    ).toHaveAttribute('value', 'unknown');
  });

  it('vem preenchido com os filtros da URL', () => {
    renderFilters({
      q: 'knight',
      genre: ['puzzle'],
      country: 'br',
      status: 'upcoming',
      portuguese: 'no',
      sort: 'name',
    });

    expect(screen.getByRole('searchbox', { name: 'Buscar pelo nome' })).toHaveValue('knight');
    expect(screen.getByRole('checkbox', { name: 'Quebra-cabeça (3.607)' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Aventura (10.922)' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Brasil (251)' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Situação' })).toHaveValue('upcoming');
    expect(screen.getByRole('combobox', { name: 'Português' })).toHaveValue('no');
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toHaveValue('name');
  });

  it('abre só os grupos que têm algo marcado', () => {
    const { container } = renderFilters({ theme: 'horror' });

    const open = [...container.querySelectorAll('details[open] summary')].map(
      (summary) => summary.textContent,
    );
    expect(open).toEqual(['Tema (1)']);
  });

  it('não leva a página: filtrar de novo volta para a primeira', () => {
    const { container } = renderFilters({ page: '3' });

    expect(container.querySelector('[name="page"]')).not.toBeInTheDocument();
  });

  it('limpar filtros leva ao catálogo sem parâmetros', () => {
    renderFilters({ genre: 'puzzle' });

    expect(screen.getByRole('link', { name: 'Limpar filtros' })).toHaveAttribute(
      'href',
      '/catalogo',
    );
  });
});
