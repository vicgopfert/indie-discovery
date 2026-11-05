import Link from 'next/link';

// Sem o link da anterior ou da próxima quando não há para onde ir.
export function Pagination({
  label,
  previousHref,
  nextHref,
}: {
  label: string;
  previousHref: string | undefined;
  nextHref: string | undefined;
}) {
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-4 text-sm">
      {previousHref ? (
        <Link href={previousHref} rel="prev" className="underline">
          Anterior
        </Link>
      ) : (
        <span />
      )}
      <span aria-current="page">{label}</span>
      {nextHref ? (
        <Link href={nextHref} rel="next" className="underline">
          Próxima
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
