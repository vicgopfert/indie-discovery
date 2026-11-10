import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export const COLLECTIONS_LOADING = 'Carregando coleções…';

export function CollectionsUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      Não foi possível carregar as coleções agora.{' '}
      {/* Recarrega a página inteira, como no catálogo. */}
      <a href={retryHref} className="underline">
        Tentar de novo
      </a>
    </p>
  );
}

export function CollectionUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar a coleção</AlertTitle>
      <AlertDescription>
        <p>O servidor não respondeu; tente de novo em instantes.</p>
        <a href={retryHref} className="underline">
          Tentar de novo
        </a>
      </AlertDescription>
    </Alert>
  );
}

export function PageBeyondCollection({ firstPageHref }: { firstPageHref: string }) {
  return (
    <p>
      Esta página não existe nesta coleção.{' '}
      <Link href={firstPageHref} className="underline">
        Voltar para a primeira página
      </Link>
    </p>
  );
}
