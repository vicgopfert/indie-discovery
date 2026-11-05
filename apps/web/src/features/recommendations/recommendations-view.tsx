'use client';

import type { DiscoveryMode, RecommendationOverview } from '@indie/contracts';
import { useRecommendationOverview } from './hooks';
import { RECOMMENDATIONS_PATH } from './lists';
import { RecommendationCard } from './recommendation-card';
import {
  BasisNote,
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
      <RecommendedGames overview={overview.data} updating={overview.isPlaceholderData} />
    </div>
  );
}

function RecommendedGames({
  overview: {
    mode,
    basis,
    main: { items },
  },
  updating,
}: {
  overview: RecommendationOverview;
  updating: boolean;
}) {
  if (basis === 'empty') return <EmptyProfile />;

  return (
    <section aria-label="Jogos recomendados" aria-busy={updating} className="space-y-6">
      <BasisNote basis={basis} mode={mode} />
      {items.length > 0 ? (
        <ul className="space-y-6">
          {items.map((recommendation) => (
            <li key={recommendation.game.slug}>
              <RecommendationCard recommendation={recommendation} />
            </li>
          ))}
        </ul>
      ) : (
        <p>Não há jogos novos para recomendar com o seu perfil.</p>
      )}
    </section>
  );
}
