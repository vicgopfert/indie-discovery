import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { UserMenu } from '@/features/auth/user-menu';

// Abaixo de 640 px, os links principais descem para uma segunda linha: numa linha só, o cabeçalho
// passava da tela a 390 px. Solução provisória até o redesign.
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold whitespace-nowrap">
          {siteConfig.name}
        </Link>
        <nav
          aria-label="Principal"
          className="order-last flex w-full gap-4 sm:order-0 sm:w-auto sm:flex-1"
        >
          <Link href="/catalogo" className="text-sm hover:underline">
            Catálogo
          </Link>
          <Link href="/colecoes" className="text-sm hover:underline">
            Coleções
          </Link>
          <Link href="/recomendacoes" className="text-sm hover:underline">
            Recomendações
          </Link>
        </nav>
        <UserMenu />
      </div>
    </header>
  );
}
