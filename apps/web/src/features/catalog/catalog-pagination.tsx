import type { GameSearchQuery } from '@indie/contracts';
import Link from 'next/link';
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
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
      {page > 1 ? (
        <Link href={catalogHref(query, page - 1)} rel="prev" className="underline">
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span aria-current="page">
        Página {page} de {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={catalogHref(query, page + 1)} rel="next" className="underline">
          Próxima
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
