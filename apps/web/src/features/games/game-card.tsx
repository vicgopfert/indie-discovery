import type { GameSummary } from '@indie/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GameCover } from './game-cover';
import { releaseLabel } from './release-label';
import { UpcomingBadge } from './upcoming-badge';

// O nível do título segue a página: h2 numa lista solta, h3 dentro de uma seção com título.
export function GameCard({
  game,
  headingLevel: Heading = 'h2',
  children,
}: {
  game: GameSummary;
  headingLevel?: 'h2' | 'h3';
  children?: ReactNode;
}) {
  return (
    <article className="flex gap-4">
      <GameCover name={game.name} coverImageId={game.coverImageId} size="small" />
      <div className="space-y-1">
        <Heading className="font-medium">
          <Link href={`/jogos/${game.slug}`} className="hover:underline">
            {game.name}
          </Link>
        </Heading>
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
