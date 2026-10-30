import Link from 'next/link';
import { CATALOG_PATH } from '@/features/catalog/search-params';

export default function GameNotFound() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Jogo não encontrado</h1>
      <p>O endereço pode estar errado, ou o jogo saiu do catálogo.</p>
      <Link href={CATALOG_PATH} className="underline">
        Ver o catálogo
      </Link>
    </main>
  );
}
