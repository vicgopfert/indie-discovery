import type { CollectionSummary } from '@indie/contracts';
import Link from 'next/link';
import { use } from 'react';
import { GameCover } from '@/features/games/game-cover';
import { CollectionsUnavailable } from './collection-states';
import { collectionHref, gameCountLabel } from './paths';

type Collections = Promise<CollectionSummary[] | null>;

// A vitrine "Explore por cultura", na ordem do arquivo de curadoria (Brasil primeiro). Recebe a
// promessa da página, para aparecer dentro de um Suspense sem segurar o resto dela.
export function CollectionShowcase({
  collections,
  titleAs: Title,
  retryHref,
}: {
  collections: Collections;
  titleAs: 'h2' | 'h3';
  retryHref: string;
}) {
  const list = use(collections);
  if (!list) return <CollectionsUnavailable retryHref={retryHref} />;

  return (
    <ul className="grid gap-6 sm:grid-cols-2">
      {list.map((collection) => (
        <li key={collection.slug}>
          <article className="space-y-2">
            <Title className="font-medium">
              <Link href={collectionHref(collection.slug)} className="hover:underline">
                {collection.name}
              </Link>
            </Title>
            <p className="text-sm">{collection.description}</p>
            <p className="text-sm text-muted-foreground">{gameCountLabel(collection.gameCount)}</p>
            <div className="grid grid-cols-4 gap-2">
              {collection.coverImageIds.map((coverImageId, i) => (
                <GameCover
                  key={i}
                  name={collection.name}
                  coverImageId={coverImageId}
                  size="fluid"
                />
              ))}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

// No catálogo, só os nomes: os filtros continuam em primeiro plano. Sem as coleções, não aparece.
export function CollectionLinks({ collections }: { collections: Collections }) {
  const list = use(collections);
  if (!list || list.length === 0) return null;

  return (
    <nav aria-label="Explore por cultura" className="text-sm">
      <span className="font-medium">Explore por cultura:</span>{' '}
      <ul className="inline">
        {list.map(({ slug, name }) => (
          <li key={slug} className="mr-3 inline">
            <Link href={collectionHref(slug)} className="underline">
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
