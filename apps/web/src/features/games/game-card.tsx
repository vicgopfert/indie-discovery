import type { GameSummary } from '@indie/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { GameCover } from './game-cover';
import { releaseLabel } from './release-label';
import { UpcomingBadge } from './upcoming-badge';

// linked: o jogo que saiu do catálogo não tem ficha, e o nome aparece sem link.
export function GameCard({
  game,
  linked = true,
  headingLevel: Heading = 'h2',
  titleId,
  children,
}: {
  game: GameSummary;
  linked?: boolean;
  headingLevel?: 'h2' | 'h3';
  titleId?: string;
  children?: ReactNode;
}) {
  return (
    <article className="flex gap-4">
      <GameCover name={game.name} coverImageId={game.coverImageId} size="small" />
      <div className="space-y-1">
        <Heading id={titleId} className="font-medium">
          {linked ? (
            <Link href={`/jogos/${game.slug}`} className="hover:underline">
              {game.name}
            </Link>
          ) : (
            game.name
          )}
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
