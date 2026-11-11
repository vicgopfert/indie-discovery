import type { Metadata } from 'next';
import { OnboardingView } from '@/features/onboarding/onboarding-view';
import { RECOMMENDATIONS_PATH } from '@/features/recommendations/lists';
import { type AuthPageProps, safeRedirect } from '@/lib/safe-redirect';

export const metadata: Metadata = { title: 'Seus gostos', robots: { index: false } };

export default async function OnboardingPage({ searchParams }: AuthPageProps) {
  const next = safeRedirect((await searchParams).next, RECOMMENDATIONS_PATH);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <OnboardingView next={next} />
    </main>
  );
}
