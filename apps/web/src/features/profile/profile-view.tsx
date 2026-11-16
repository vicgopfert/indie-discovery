'use client';

import type { Library, Preferences, User } from '@indie/contracts';
import { useIsMutating } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { SessionGate, useClearAccountWhenUnauthorized } from '@/features/auth/session-gate';
import { LIBRARY_QUERY_KEY, useLibrary } from '@/features/library/hooks';
import { usePreferences } from '@/features/onboarding/hooks';
import { onboardingHref } from '@/features/onboarding/paths';
import { PROFILE_PATH } from './paths';
import { ListSection, RatingsSection, TastesSection } from './profile-sections';
import { UserAvatar } from './user-avatar';

export function ProfileView() {
  return (
    <SessionGate next={PROFILE_PATH} invite="para ver o seu perfil.">
      {(user) => <Profile user={user} />}
    </SessionGate>
  );
}

function Profile({ user }: { user: User }) {
  const library = useLibrary();
  const preferences = usePreferences();
  useClearAccountWhenUnauthorized(library.error ?? preferences.error);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <UserAvatar name={user.displayName} size="lg" />
        <p className="text-lg font-medium break-words">{user.displayName}</p>
      </div>
      {library.isPending || preferences.isPending ? (
        <p className="text-sm text-muted-foreground">Carregando o seu perfil…</p>
      ) : library.isError || preferences.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível carregar o seu perfil; recarregue a página.
        </p>
      ) : (
        <ProfileContent
          library={library.data}
          preferences={preferences.data}
          refreshing={library.isFetching}
        />
      )}
    </div>
  );
}

function ProfileContent({
  library,
  preferences,
  refreshing,
}: {
  library: Library;
  preferences: Preferences;
  refreshing: boolean;
}) {
  const saving = useIsMutating({ mutationKey: LIBRARY_QUERY_KEY }) > 0;
  const [status, setStatus] = useState('');

  if (isEmpty(library, preferences)) {
    return (
      <p>
        Seu perfil ainda está vazio. Conte do que você gosta para receber recomendações.{' '}
        <Link href={onboardingHref(PROFILE_PATH)} className="underline">
          Escolher meus gostos
        </Link>
      </p>
    );
  }

  // Até a biblioteca recarregar, os controles ficam desabilitados: o jogo removido ainda está na
  // tela, e a ação seguinte partiria de um estado antigo.
  const busy = saving || refreshing;
  const sectionProps = { library, busy, onDone: setStatus };
  return (
    <div className="space-y-10">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {saving ? 'Salvando…' : status}
      </p>
      <TastesSection preferences={preferences} />
      <RatingsSection {...sectionProps} />
      <ListSection list="FAVORITE" {...sectionProps} />
      <ListSection list="COMPLETED" {...sectionProps} />
      <ListSection list="WANT_TO_PLAY" {...sectionProps} />
    </div>
  );
}

function isEmpty({ ratings, lists }: Library, { genres, themes, tags }: Preferences) {
  return [ratings, lists.FAVORITE, lists.COMPLETED, lists.WANT_TO_PLAY, genres, themes, tags].every(
    (items) => items.length === 0,
  );
}
