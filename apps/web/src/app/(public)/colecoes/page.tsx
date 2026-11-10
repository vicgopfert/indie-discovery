import type { Metadata } from 'next';
import { Suspense } from 'react';
import { listCollectionsOrNull } from '@/features/collections/api';
import { CollectionShowcase } from '@/features/collections/collection-showcase';
import { COLLECTIONS_LOADING } from '@/features/collections/collection-states';
import { COLLECTIONS_PATH } from '@/features/collections/paths';

export const metadata: Metadata = {
  title: 'Explore por cultura',
  description:
    'Coleções curadas de jogos independentes em que a cultura está no centro: mitologia, folclore, história e cotidiano.',
};

// A cada requisição: gerada no build, a página guardaria a resposta da API daquele momento.
export const dynamic = 'force-dynamic';

export default function CollectionsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Explore por cultura</h1>
      <p>
        Coleções curadas de jogos em que a cultura está no centro: mitologia, folclore, história e
        cotidiano.
      </p>
      <Suspense fallback={<p>{COLLECTIONS_LOADING}</p>}>
        <CollectionShowcase
          collections={listCollectionsOrNull()}
          titleAs="h2"
          retryHref={COLLECTIONS_PATH}
        />
      </Suspense>
    </main>
  );
}
