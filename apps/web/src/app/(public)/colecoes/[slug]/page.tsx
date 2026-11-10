import type { GamePage } from '@indie/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Pagination } from '@/components/pagination';
import { getCollection } from '@/features/collections/api';
import {
  CollectionUnavailable,
  PageBeyondCollection,
} from '@/features/collections/collection-states';
import {
  COLLECTIONS_PATH,
  collectionHref,
  gameCountLabel,
  parseCollectionPage,
} from '@/features/collections/paths';
import { GameCard } from '@/features/games/game-card';
import { isNotFound } from '@/lib/api-client';

type CollectionPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function loadCollection({ params, searchParams }: CollectionPageProps) {
  const { slug } = await params;
  const page = parseCollectionPage((await searchParams).page);
  try {
    return { slug, page, collection: await getCollection(slug, page), missing: false };
  } catch (error) {
    return { slug, page, collection: null, missing: isNotFound(error) };
  }
}

export async function generateMetadata(props: CollectionPageProps): Promise<Metadata> {
  const { collection, missing } = await loadCollection(props);
  if (!collection) return { title: missing ? 'Coleção não encontrada' : 'Coleção' };
  return { title: collection.name, description: collection.description };
}

// Sem loading.tsx, como a ficha do jogo: com ele, o 404 sairia com status 200.
export default async function CollectionPage(props: CollectionPageProps) {
  const { slug, page, collection, missing } = await loadCollection(props);
  if (missing) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link href={COLLECTIONS_PATH} className="text-sm underline">
        Todas as coleções
      </Link>
      {collection ? (
        <>
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">{collection.name}</h1>
            <p>{collection.description}</p>
            <p className="text-sm text-muted-foreground">
              {gameCountLabel(collection.games.total)}
            </p>
          </header>
          <CollectionGames slug={slug} games={collection.games} />
        </>
      ) : (
        <CollectionUnavailable retryHref={collectionHref(slug, page)} />
      )}
    </main>
  );
}

function CollectionGames({
  slug,
  games: { items, page, totalPages },
}: {
  slug: string;
  games: GamePage;
}) {
  if (items.length === 0) return <PageBeyondCollection firstPageHref={collectionHref(slug)} />;

  return (
    <>
      <ul className="space-y-6">
        {items.map((game) => (
          <li key={game.slug}>
            <GameCard game={game} />
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <Pagination
          label={`Página ${page} de ${totalPages}`}
          previousHref={page > 1 ? collectionHref(slug, page - 1) : undefined}
          nextHref={page < totalPages ? collectionHref(slug, page + 1) : undefined}
        />
      )}
    </>
  );
}
