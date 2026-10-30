import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl space-y-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">{siteConfig.name}</h1>
      <p>{siteConfig.description}</p>
      <Button asChild>
        <Link href="/catalogo">Ver o catálogo</Link>
      </Button>
    </main>
  );
}
