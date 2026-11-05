import type { GameSummary } from '@indie/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GameCover } from './game-cover';
import { releaseLabel } from './release-label';
import { UpcomingBadge } from './upcoming-badge';

export function GameCard({ game, children }: { game: GameSummary; children?: ReactNode }) {
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
        {children}
      </div>
    </article>
  );
}
