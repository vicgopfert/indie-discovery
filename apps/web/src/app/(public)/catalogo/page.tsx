import type { GameSearchQuery } from '@indie/contracts';
import type { Metadata } from 'next';
import { listCountries, listFeatures, searchGames } from '@/features/catalog/api';
import { CatalogFilters } from '@/features/catalog/catalog-filters';
import { CatalogPagination } from '@/features/catalog/catalog-pagination';
import {
  CatalogUnavailable,
  InvalidFilters,
  NoGamesFound,
} from '@/features/catalog/catalog-states';
import { GameCard } from '@/features/catalog/game-card';
import {
  type CatalogSearchParams,
  catalogHref,
  parseCatalogParams,
} from '@/features/catalog/search-params';

export const metadata: Metadata = {
  title: 'Catálogo',
  description: 'Jogos independentes com filtros de gênero, tema, situação, português e país.',
};

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const params = parseCatalogParams(await searchParams);
  const content = params.ok ? (
    await loadCatalog(params.query)
  ) : (
    <InvalidFilters errors={params.errors} />
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Catálogo</h1>
      {content}
    </main>
  );
}

async function loadCatalog(query: GameSearchQuery) {
  const data = await Promise.all([
    searchGames(query),
    listFeatures('genre'),
    listFeatures('theme'),
    listCountries(),
  ]).catch(() => null);
  if (!data) return <CatalogUnavailable retryHref={catalogHref(query)} />;

  const [page, genres, themes, countries] = data;
  const beyondLastPage = page.items.length === 0 && page.total > 0;

  return (
    <div className="grid gap-8 md:grid-cols-[16rem_1fr]">
      <aside aria-label="Filtros">
        <CatalogFilters query={query} options={{ genres, themes, countries }} />
      </aside>
      <section aria-label="Resultados" className="space-y-6">
        <p className="text-sm text-muted-foreground">
          {page.total === 1 ? '1 jogo' : `${page.total.toLocaleString('pt-BR')} jogos`}
        </p>
        {page.items.length > 0 ? (
          <>
            <ul className="space-y-6">
              {page.items.map((game) => (
                <li key={game.slug}>
                  <GameCard game={game} />
                </li>
              ))}
            </ul>
            <CatalogPagination query={query} totalPages={page.totalPages} />
          </>
        ) : (
          <NoGamesFound firstPageHref={beyondLastPage ? catalogHref(query, 1) : undefined} />
        )}
      </section>
    </div>
  );
}
