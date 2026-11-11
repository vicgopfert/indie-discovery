'use client';

import type { DiscoveryMode, RecommendationOverview } from '@indie/contracts';
import Link from 'next/link';
import { type ReactNode, useId } from 'react';
import { CoverRow } from './cover-row';
import { useRecommendationOverview } from './hooks';
import { listHref, listTitle, RECOMMENDATIONS_PATH } from './lists';
import {
  BasisNote,
  ChangeTastesLink,
  EmptyProfile,
  ModeControls,
  RecommendationsError,
  RecommendationsLoading,
  SessionGate,
  useClearAccountWhenUnauthorized,
} from './recommendation-states';

export function RecommendationsView() {
  return (
    <SessionGate next={RECOMMENDATIONS_PATH}>
      {(user) => <Recommendations mode={user.discoveryMode} />}
    </SessionGate>
  );
}

function Recommendations({ mode }: { mode: DiscoveryMode }) {
  const overview = useRecommendationOverview(mode);
  useClearAccountWhenUnauthorized(overview.error);

  if (overview.isPending) return <RecommendationsLoading />;
  if (overview.isError) {
    return (
      <RecommendationsError
        error={overview.error}
        retrying={overview.isFetching}
        onRetry={() => void overview.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ModeControls mode={mode} basis={overview.data.basis} updating={overview.isPlaceholderData} />
      {overview.data.basis !== 'empty' && <ChangeTastesLink />}
      <RecommendedGames overview={overview.data} updating={overview.isPlaceholderData} />
    </div>
  );
}

// A principal no topo e as prateleiras na ordem da API (por jogo, por interesse e "Em breve"); a
// API já tirou as repetições. Todas são fileiras de capas; os cartões completos, com o motivo e os
// selos, ficam no "ver mais".
function RecommendedGames({
  overview: { mode, basis, main, shelves },
  updating,
}: {
  overview: RecommendationOverview;
  updating: boolean;
}) {
  if (basis === 'empty') return <EmptyProfile />;

  return (
    <div aria-busy={updating} className="space-y-10">
      <BasisNote basis={basis} mode={mode} withBadges={false} />
      <ListSection listKey="main" title={listTitle('main')} hasMore={main.hasMore}>
        {main.items.length > 0 ? (
          <CoverRow items={main.items} />
        ) : (
          <p>Não há jogos novos para recomendar com o seu perfil.</p>
        )}
      </ListSection>
      {shelves.map((shelf) => (
        <ListSection
          key={shelf.key}
          listKey={shelf.key}
          title={listTitle(shelf.key, shelf)}
          hasMore={shelf.hasMore}
        >
          <CoverRow items={shelf.items} />
        </ListSection>
      ))}
    </div>
  );
}

function ListSection({
  listKey,
  title,
  hasMore,
  children,
}: {
  listKey: string;
  title: string;
  hasMore: boolean;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-xl font-semibold">
          {title}
        </h2>
        {hasMore && (
          <Link href={listHref(listKey)} className="text-sm underline">
            Ver mais<span className="sr-only">: {title}</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
