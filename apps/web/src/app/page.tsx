import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';
import { listCollectionsOrNull } from '@/features/collections/api';
import { CollectionShowcase } from '@/features/collections/collection-showcase';
import { COLLECTIONS_LOADING } from '@/features/collections/collection-states';

// A cada requisição: gerada no build, a vitrine guardaria a resposta da API daquele momento.
export const dynamic = 'force-dynamic';

// A vitrine vem num Suspense: com a API acordando, o resto da página não espera por ela.
export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">{siteConfig.name}</h1>
      <p>{siteConfig.description}</p>
      <Button asChild>
        <Link href="/catalogo">Ver o catálogo</Link>
      </Button>
      <section aria-labelledby="explore-by-culture" className="space-y-4 pt-6">
        <h2 id="explore-by-culture" className="text-xl font-semibold">
          Explore por cultura
        </h2>
        <Suspense fallback={<p>{COLLECTIONS_LOADING}</p>}>
          <CollectionShowcase collections={listCollectionsOrNull()} titleAs="h3" retryHref="/" />
        </Suspense>
      </section>
    </main>
  );
}
