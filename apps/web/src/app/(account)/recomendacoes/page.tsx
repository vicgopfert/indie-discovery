import type { Metadata } from 'next';
import { RecommendationsView } from '@/features/recommendations/recommendations-view';

export const metadata: Metadata = { title: 'Recomendações', robots: { index: false } };

export default function RecommendationsPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Recomendações</h1>
      <RecommendationsView />
    </main>
  );
}
