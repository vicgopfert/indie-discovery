import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function GameUnavailable({ retryHref }: { retryHref: string }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Não foi possível carregar o jogo</AlertTitle>
      <AlertDescription>
        <p>O servidor não respondeu; tente de novo em instantes.</p>
        {/* Recarrega a página inteira, como no catálogo. */}
        <a href={retryHref} className="underline">
          Tentar de novo
        </a>
      </AlertDescription>
    </Alert>
  );
}
