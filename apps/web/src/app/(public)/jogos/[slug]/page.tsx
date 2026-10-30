import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CATALOG_PATH } from '@/features/catalog/search-params';
import { getGame } from '@/features/games/api';
import { GameDetails } from '@/features/games/game-details';
import { metaDescription } from '@/features/games/game-facts';
import { GameUnavailable } from '@/features/games/game-states';
import { ApiRequestError } from '@/lib/api-client';
import { igdbImageUrl } from '@/lib/igdb';

type GamePageProps = { params: Promise<{ slug: string }> };

async function loadGame(slug: string) {
  try {
    return { game: await getGame(slug) };
  } catch (error) {
    const missing = error instanceof ApiRequestError && error.status === 404;
    return { game: null, missing };
  }
}

export async function generateMetadata({ params }: GamePageProps): Promise<Metadata> {
  const { game, missing } = await loadGame((await params).slug);
  if (!game) return { title: missing ? 'Jogo não encontrado' : 'Jogo' };

  const description = metaDescription(game.summary);
  return {
    title: game.name,
    description,
    openGraph: {
      title: game.name,
      description,
      ...(game.coverImageId && { images: [igdbImageUrl(game.coverImageId, 'cover_big_2x')] }),
    },
  };
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params;
  const { game, missing } = await loadGame(slug);
  // Jogo inexistente ou fora do catálogo responde 404. Este segmento não tem loading.tsx de
  // propósito: com ele, a resposta começa em streaming e o 404 sairia com status 200.
  if (missing) notFound();

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Link href={CATALOG_PATH} className="text-sm underline">
        Voltar ao catálogo
      </Link>
      {game ? (
        <GameDetails game={game} />
      ) : (
        <GameUnavailable retryHref={`/jogos/${encodeURIComponent(slug)}`} />
      )}
    </main>
  );
}
