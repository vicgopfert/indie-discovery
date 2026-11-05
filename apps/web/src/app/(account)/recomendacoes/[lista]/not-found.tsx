import Link from 'next/link';
import { RECOMMENDATIONS_PATH } from '@/features/recommendations/lists';

export default function RecommendationListNotFound() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Lista não encontrada</h1>
      <p>O endereço não corresponde a nenhuma lista de recomendações.</p>
      <Link href={RECOMMENDATIONS_PATH} className="underline">
        Ver suas recomendações
      </Link>
    </main>
  );
}
