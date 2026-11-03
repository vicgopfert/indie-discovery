import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { UserMenu } from '@/features/auth/user-menu';

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold">
            {siteConfig.name}
          </Link>
          <nav aria-label="Principal" className="flex gap-4">
            <Link href="/catalogo" className="text-sm hover:underline">
              Catálogo
            </Link>
            <Link href="/recomendacoes" className="text-sm hover:underline">
              Recomendações
            </Link>
          </nav>
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
