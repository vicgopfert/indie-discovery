'use client';

import type { DiscoveryMode, RecommendationPage } from '@indie/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Pagination } from '@/components/pagination';
import { isNotFound } from '@/lib/api-client';
import { useRecommendationPage } from './hooks';
import { listHref, listTitle, RECOMMENDATIONS_PATH } from './lists';
import { RecommendationGrid } from './recommendation-grid';
import {
  BasisNote,
  EmptyProfile,
  ModeControls,
  RecommendationsError,
  RecommendationsLoading,
  SessionGate,
  useClearAccountWhenUnauthorized,
} from './recommendation-states';

type ListProps = { listKey: string; page: number };

function ListHeading({ title }: { title: string }) {
  return <h1 className="text-2xl font-semibold">{title}</h1>;
}

export function RecommendationListView({ listKey, page }: ListProps) {
  return (
    <div className="space-y-6">
      <Link href={RECOMMENDATIONS_PATH} className="text-sm underline">
        Voltar às recomendações
      </Link>
      <SessionGate
        next={listHref(listKey, page)}
        heading={<ListHeading title={listTitle(listKey, null)} />}
      >
        {(user) => <RecommendationList listKey={listKey} page={page} mode={user.discoveryMode} />}
      </SessionGate>
    </div>
  );
}

function RecommendationList({ listKey, page, mode }: ListProps & { mode: DiscoveryMode }) {
  const router = useRouter();
  const list = useRecommendationPage(listKey, mode, page);
  useClearAccountWhenUnauthorized(list.error);

  // A lista deixou de existir: o perfil mudou depois de a visão geral ser lida.
  const missing = isNotFound(list.error);
  useEffect(() => {
    if (missing) router.replace(RECOMMENDATIONS_PATH);
  }, [missing, router]);

  const heading = <ListHeading title={listTitle(listKey, list.data?.feature)} />;
  if (list.isPending || missing) {
    return (
      <>
        {heading}
        <RecommendationsLoading />
      </>
    );
  }
  if (list.isError) {
    return (
      <>
        {heading}
        <RecommendationsError
          error={list.error}
          retrying={list.isFetching}
          onRetry={() => void list.refetch()}
        />
      </>
    );
  }

  return (
    <>
      {heading}
      {/* A página N de outro modo é outra lista: gravado o modo, a lista recomeça. */}
      <ModeControls
        mode={mode}
        basis={list.data.basis}
        updating={list.isPlaceholderData}
        onSaved={() => {
          if (page > 1) router.replace(listHref(listKey));
        }}
      />
      <ListGames list={list.data} updating={list.isPlaceholderData} />
    </>
  );
}

function ListGames({ list, updating }: { list: RecommendationPage; updating: boolean }) {
  const { mode, basis, key, page, items, hasMore } = list;
  if (basis === 'empty') return <EmptyProfile />;

  return (
    <section aria-label="Jogos recomendados" aria-busy={updating} className="space-y-6">
      <BasisNote basis={basis} mode={mode} withBadges />
      {items.length > 0 ? (
        <RecommendationGrid items={items} />
      ) : page > 1 ? (
        <p>
          Esta lista não tem mais jogos.{' '}
          <Link href={listHref(key)} className="underline">
            Voltar para a primeira página
          </Link>
        </p>
      ) : (
        <p>Não há jogos novos para recomendar com o seu perfil.</p>
      )}
      {(page > 1 || hasMore) && items.length > 0 && (
        <Pagination
          label={`Página ${page}`}
          previousHref={page > 1 ? listHref(key, page - 1) : undefined}
          nextHref={hasMore ? listHref(key, page + 1) : undefined}
        />
      )}
    </section>
  );
}
