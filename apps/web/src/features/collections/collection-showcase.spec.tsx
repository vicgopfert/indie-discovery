import type { CollectionSummary } from '@indie/contracts';
import { screen } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { sampleCollection } from '@/test/catalog';
import { renderAwaitingData } from '@/test/render';
import { CollectionLinks, CollectionShowcase } from './collection-showcase';

const renderShowcase = (collections: CollectionSummary[] | null) =>
  renderAwaitingData(
    <Suspense fallback={<p>Carregando</p>}>
      <CollectionShowcase
        collections={Promise.resolve(collections)}
        titleAs="h2"
        retryHref="/colecoes"
      />
    </Suspense>,
  );

describe('CollectionShowcase', () => {
  it('mostra cada coleção na ordem recebida, com a descrição, a contagem e o link', async () => {
    await renderShowcase([
      sampleCollection(),
      sampleCollection({
        slug: 'mundo-celta',
        name: 'Mundo celta',
        description: 'Mitos e lendas celtas.',
        gameCount: 1,
      }),
    ]);

    const titles = await screen.findAllByRole('heading', { level: 2 });
    expect(titles.map((title) => title.textContent)).toEqual(['Brasil', 'Mundo celta']);
    expect(screen.getByRole('link', { name: 'Brasil' })).toHaveAttribute(
      'href',
      '/colecoes/brasil',
    );
    expect(screen.getByText('Mitos e lendas celtas.')).toBeInTheDocument();
    expect(screen.getByText('29 jogos')).toBeInTheDocument();
    expect(screen.getByText('1 jogo')).toBeInTheDocument();
  });

  it('se a API falhar, avisa e oferece tentar de novo na mesma página', async () => {
    await renderShowcase(null);

    expect(await screen.findByText(/Não foi possível carregar as coleções/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tentar de novo' })).toHaveAttribute(
      'href',
      '/colecoes',
    );
  });
});

describe('CollectionLinks', () => {
  const renderLinks = (collections: CollectionSummary[] | null) =>
    renderAwaitingData(
      <Suspense fallback={null}>
        <CollectionLinks collections={Promise.resolve(collections)} />
      </Suspense>,
    );

  it('lista os nomes em links', async () => {
    await renderLinks([sampleCollection(), sampleCollection({ slug: 'japao', name: 'Japão' })]);

    expect(await screen.findByRole('link', { name: 'Japão' })).toHaveAttribute(
      'href',
      '/colecoes/japao',
    );
    expect(screen.getByRole('link', { name: 'Brasil' })).toBeInTheDocument();
  });

  it('sem as coleções, não mostra nada', async () => {
    const { container } = await renderLinks(null);

    expect(container).toBeEmptyDOMElement();
  });
});
