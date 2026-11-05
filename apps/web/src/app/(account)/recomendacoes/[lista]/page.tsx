import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { listKeyOf, parseListPage } from '@/features/recommendations/lists';
import { RecommendationListView } from '@/features/recommendations/recommendation-list-view';

export const metadata: Metadata = { title: 'Recomendações', robots: { index: false } };

export default async function RecommendationListPage({
  params,
  searchParams,
}: PageProps<'/recomendacoes/[lista]'>) {
  const key = listKeyOf((await params).lista);
  if (!key) notFound();
  const { page } = await searchParams;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* Uma lista nova começa do zero, sem a anterior na tela enquanto carrega. */}
      <RecommendationListView key={key} listKey={key} page={parseListPage(page)} />
    </main>
  );
}
