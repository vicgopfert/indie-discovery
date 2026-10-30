import type { GameSummary } from '@indie/contracts';
import Link from 'next/link';
import { GameCover } from '@/features/games/game-cover';
import { releaseLabel } from '@/features/games/release-label';
import { UpcomingBadge } from '@/features/games/upcoming-badge';

export function GameCard({ game }: { game: GameSummary }) {
  return (
    <article className="flex gap-4">
      <GameCover name={game.name} coverImageId={game.coverImageId} size="small" />
      <div className="space-y-1">
        <h2 className="font-medium">
          <Link href={`/jogos/${game.slug}`} className="hover:underline">
            {game.name}
          </Link>
        </h2>
        <UpcomingBadge releaseStatus={game.releaseStatus} />
        <p className="text-sm text-muted-foreground">{releaseLabel(game)}</p>
        {game.genres.length > 0 && (
          <p className="text-sm">{game.genres.map(({ name }) => name).join(' · ')}</p>
        )}
      </div>
    </article>
  );
}
