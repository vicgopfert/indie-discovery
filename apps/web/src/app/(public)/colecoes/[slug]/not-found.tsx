import Link from 'next/link';
import { COLLECTIONS_PATH } from '@/features/collections/paths';

export default function CollectionNotFound() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Coleção não encontrada</h1>
      <p>O endereço pode estar errado, ou a coleção não tem mais jogos no catálogo.</p>
      <Link href={COLLECTIONS_PATH} className="underline">
        Ver todas as coleções
      </Link>
    </main>
  );
}
