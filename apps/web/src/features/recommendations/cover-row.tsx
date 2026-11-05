import type { Recommendation } from '@indie/contracts';
import Link from 'next/link';
import { GameCover } from '@/features/games/game-cover';

// Só as capas: o nome vai no link para leitores de tela e no title para quem passa o mouse. Abaixo
// de 640 px, a fileira rola na horizontal em vez de encolher as capas.
export function CoverRow({ items }: { items: readonly Recommendation[] }) {
  return (
    <ul className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
      {items.map(({ game }) => (
        <li key={game.slug} className="w-24 shrink-0 snap-start sm:w-auto">
          <Link
            href={`/jogos/${game.slug}`}
            aria-label={game.name}
            title={game.name}
            className="block rounded-md hover:opacity-90"
          >
            <GameCover name={game.name} coverImageId={game.coverImageId} size="fluid" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
