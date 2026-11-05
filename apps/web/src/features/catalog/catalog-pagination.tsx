import type { GameSearchQuery } from '@indie/contracts';
import { Pagination } from '@/components/pagination';
import { catalogHref } from './search-params';

export function CatalogPagination({
  query,
  totalPages,
}: {
  query: GameSearchQuery;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const { page } = query;

  return (
    <Pagination
      label={`Página ${page} de ${totalPages}`}
      previousHref={page > 1 ? catalogHref(query, page - 1) : undefined}
      nextHref={page < totalPages ? catalogHref(query, page + 1) : undefined}
    />
  );
}
