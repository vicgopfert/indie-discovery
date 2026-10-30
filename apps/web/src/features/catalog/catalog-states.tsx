import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CATALOG_PATH } from './search-params';

export function NoGamesFound({ firstPageHref }: { firstPageHref: string | undefined }) {
  if (firstPageHref) {
    return (
      <p>
        Esta página não existe para esses filtros.{' '}
        <Link href={firstPageHref} className="underline">
          Voltar para a primeira página
        </Link>
      </p>
    );
  }
  return (
    <p>
      Nenhum jogo com esses filtros.{' '}
      <Link href={CATALOG_PATH} className="underline">
        Limpar filtros
      </Link>
    </p>
  );
}

export function InvalidFilters({ errors }: { errors: string[] }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível usar esses filtros</AlertTitle>
      <AlertDescription>
        <ul className="list-disc pl-4">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
        <Link href={CATALOG_PATH} className="underline">
          Limpar filtros
        </Link>
      </AlertDescription>
    </Alert>
  );
}

export function CatalogUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar o catálogo</AlertTitle>
      <AlertDescription>
        <p>O servidor não respondeu; tente de novo em instantes.</p>
        {/* Recarrega a página inteira: uma navegação para a mesma URL poderia reusar o resultado. */}
        <a href={retryHref} className="underline">
          Tentar de novo
        </a>
      </AlertDescription>
    </Alert>
  );
}
