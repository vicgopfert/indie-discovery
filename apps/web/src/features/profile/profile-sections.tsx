'use client';

import type { Library, LibraryGame, ListType, Preferences } from '@indie/contracts';
import Link from 'next/link';
import { type ReactNode, type RefObject, useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { GameCard } from '@/features/games/game-card';
import type { LibraryAction } from '@/features/library/api';
import { useLibraryAction } from '@/features/library/hooks';
import { gameStateIn } from '@/features/library/library-state';
import { RatingButtons } from '@/features/library/rating-buttons';
import { onboardingHref } from '@/features/onboarding/paths';
import { RECOMMENDATIONS_PATH } from '@/features/recommendations/lists';
import { errorMessage } from '@/lib/api-client';
import { PROFILE_PATH } from './paths';

type SectionProps = { library: Library; busy: boolean; onDone: (status: string) => void };

const LISTS: Record<ListType, { id: string; title: string; empty: ReactNode }> = {
  FAVORITE: {
    id: 'favoritos',
    title: 'Favoritos',
    empty: 'Nenhum favorito ainda. Marque Favorito na ficha de um jogo.',
  },
  COMPLETED: {
    id: 'concluidos',
    title: 'Concluídos',
    empty: 'Nenhum jogo concluído ainda. Marque Concluído na ficha de um jogo.',
  },
  WANT_TO_PLAY: {
    id: 'quero-jogar',
    title: 'Quero jogar',
    empty: (
      <>
        Nenhum jogo para jogar depois. As recomendações são um bom lugar para começar.{' '}
        <Link href={RECOMMENDATIONS_PATH} className="underline">
          Ver recomendações
        </Link>
      </>
    ),
  },
};

const TASTE_GROUPS = [
  { field: 'genres', label: 'Gêneros' },
  { field: 'themes', label: 'Temas' },
  { field: 'tags', label: 'Etiquetas' },
] as const satisfies { field: keyof Preferences; label: string }[];

export function TastesSection({ preferences }: { preferences: Preferences }) {
  const groups = TASTE_GROUPS.filter(({ field }) => preferences[field].length > 0);
  return (
    <Section id="gostos" title="Gostos">
      {groups.length === 0 ? (
        <p>Você ainda não escolheu seus gostos.</p>
      ) : (
        groups.map(({ field, label }) => (
          <p key={field} className="text-sm">
            <span className="font-medium">{label}:</span>{' '}
            {preferences[field].map(({ name }) => name).join(', ')}
          </p>
        ))
      )}
      <p className="text-sm">
        <Link href={onboardingHref(PROFILE_PATH)} className="underline">
          {groups.length === 0 ? 'Escolher meus gostos' : 'Mudar meus gostos'}
        </Link>
      </p>
    </Section>
  );
}

export function RatingsSection({ library, busy, onDone }: SectionProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { ratings } = library;
  return (
    <Section id="avaliacoes" title={`Avaliações (${ratings.length})`} headingRef={heading}>
      {ratings.length === 0 ? (
        <p>
          Você ainda não avaliou nenhum jogo. As notas são o que mais ensina o seu gosto às
          recomendações.{' '}
          <Link href="/catalogo" className="underline">
            Explorar o catálogo
          </Link>
        </p>
      ) : (
        <GameList>
          {ratings.map(({ game, score }) => (
            <li key={game.slug}>
              <RatedGame
                game={game}
                score={score}
                library={library}
                busy={busy}
                onDone={onDone}
                onRemoved={() => heading.current?.focus()}
              />
            </li>
          ))}
        </GameList>
      )}
    </Section>
  );
}

export function ListSection({ list, library, busy, onDone }: SectionProps & { list: ListType }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { id, title, empty } = LISTS[list];
  const entries = library.lists[list];
  return (
    <Section id={id} title={`${title} (${entries.length})`} headingRef={heading}>
      {entries.length === 0 ? (
        <p>{empty}</p>
      ) : (
        <GameList>
          {entries.map(({ game }) => (
            <li key={game.slug}>
              <ListedGame
                game={game}
                list={list}
                library={library}
                busy={busy}
                onDone={onDone}
                onRemoved={() => heading.current?.focus()}
              />
            </li>
          ))}
        </GameList>
      )}
    </Section>
  );
}

type GameProps = SectionProps & { game: LibraryGame; onRemoved: () => void };

function RatedGame({
  game,
  score,
  library,
  busy,
  onDone,
  onRemoved,
}: GameProps & { score: number }) {
  const titleId = useId();
  const { run, error } = useProfileAction(game, library, onDone);
  const unrate = () => run({ kind: 'unrate' }, `Nota de ${game.name} removida.`, onRemoved);
  return (
    <ProfileGameCard game={game} titleId={titleId} error={error}>
      {/* Fora do catálogo, a nota não pode mudar (a API exige o jogo no catálogo), só sair. */}
      {game.inCatalog ? (
        <RatingButtons
          score={score}
          disabled={busy}
          groupLabel={`Sua nota para ${game.name}`}
          onRate={(next) =>
            run({ kind: 'rate', score: next }, `Nota de ${game.name} alterada para ${next}.`)
          }
          onUnrate={unrate}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Sua nota: {score}</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            aria-describedby={titleId}
            onClick={unrate}
          >
            Remover nota
          </Button>
        </div>
      )}
    </ProfileGameCard>
  );
}

function ListedGame({
  game,
  list,
  library,
  busy,
  onDone,
  onRemoved,
}: GameProps & { list: ListType }) {
  const titleId = useId();
  const { run, error } = useProfileAction(game, library, onDone);
  const { title } = LISTS[list];
  return (
    <ProfileGameCard game={game} titleId={titleId} error={error}>
      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        aria-describedby={titleId}
        onClick={() => run({ kind: 'remove', list }, `${game.name} saiu de ${title}.`, onRemoved)}
      >
        Tirar de {title}
      </Button>
    </ProfileGameCard>
  );
}

// O estado atual do jogo sai da biblioteca carregada, para tirar de uma lista não apagar as outras.
function useProfileAction(game: LibraryGame, library: Library, onDone: (status: string) => void) {
  const action = useLibraryAction(game.slug, gameStateIn(library, game.slug));
  const run = (next: LibraryAction, status: string, onSuccess?: () => void) =>
    action.mutate(next, {
      onSuccess: () => {
        onDone(status);
        onSuccess?.();
      },
    });
  return { run, error: action.isError ? errorMessage(action.error) : null };
}

function ProfileGameCard({
  game,
  titleId,
  error,
  children,
}: {
  game: LibraryGame;
  titleId: string;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <GameCard game={game} linked={game.inCatalog} headingLevel="h3" titleId={titleId}>
      {!game.inCatalog && (
        <span className="inline-block rounded-md border px-2 py-0.5 text-xs font-medium">
          Fora do catálogo
        </span>
      )}
      {children}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </GameCard>
  );
}

function Section({
  id,
  title,
  headingRef,
  children,
}: {
  id: string;
  title: string;
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-titulo`} className="space-y-3">
      {/* Focável pelo código: quando o jogo removido some, o foco vem para cá, e não para o fim da
          página. */}
      <h2 id={`${id}-titulo`} ref={headingRef} tabIndex={-1} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function GameList({ children }: { children: ReactNode }) {
  return <ul className="grid gap-6 md:grid-cols-2">{children}</ul>;
}
