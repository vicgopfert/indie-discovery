import type { GameSummary } from '@indie/contracts';
import Image from 'next/image';
import Link from 'next/link';
import { igdbImageUrl } from '@/lib/igdb';
import { releaseLabel } from './release-label';

const COVER = { width: 90, height: 128 };

export function GameCard({ game }: { game: GameSummary }) {
  return (
    <article className="flex gap-4">
      <GameCover game={game} />
      <div className="space-y-1">
        <h2 className="font-medium">
          <Link href={`/jogos/${game.slug}`} className="hover:underline">
            {game.name}
          </Link>
        </h2>
        {game.releaseStatus === 'UPCOMING' && (
          <span className="inline-block rounded-md border px-2 py-0.5 text-xs font-medium">
            Em breve
          </span>
        )}
        <p className="text-sm text-muted-foreground">{releaseLabel(game)}</p>
        {game.genres.length > 0 && (
          <p className="text-sm">{game.genres.map(({ name }) => name).join(' · ')}</p>
        )}
      </div>
    </article>
  );
}

// O nome já está ao lado, então a capa é decorativa para leitores de tela.
function GameCover({ game }: { game: GameSummary }) {
  if (!game.coverImageId) {
    return (
      <div
        aria-hidden="true"
        style={COVER}
        className="flex shrink-0 items-center justify-center rounded-md bg-muted p-2 text-center text-xs text-muted-foreground"
      >
        {game.name}
      </div>
    );
  }
  return (
    <Image
      src={igdbImageUrl(game.coverImageId, 'cover_small_2x')}
      alt=""
      {...COVER}
      unoptimized
      className="shrink-0 rounded-md bg-muted object-cover"
    />
  );
}
