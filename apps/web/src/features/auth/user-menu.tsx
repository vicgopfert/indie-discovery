'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { withRedirect } from '@/lib/safe-redirect';
import { useLogout, useSession } from './hooks';

const AUTH_PAGES = ['/entrar', '/cadastrar'];

export function UserMenu() {
  const pathname = usePathname();
  const { data: user, isPending } = useSession();
  const logout = useLogout();

  // Reserva o espaço enquanto a sessão carrega, para não mostrar "Entrar" a quem já entrou.
  if (isPending) return <div aria-hidden="true" className="h-9 w-40" />;

  if (!user) {
    const next = AUTH_PAGES.includes(pathname) ? '/' : pathname;
    return (
      <nav aria-label="Conta" className="flex gap-2">
        <Button asChild variant="ghost">
          <Link href={withRedirect('/entrar', next)}>Entrar</Link>
        </Button>
        <Button asChild>
          <Link href={withRedirect('/cadastrar', next)}>Criar conta</Link>
        </Button>
      </nav>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* O nome tem até 50 caracteres: cortado com reticências, para o cabeçalho caber a 390 px. */}
      <span className="max-w-28 truncate sm:max-w-40" title={user.displayName}>
        {user.displayName}
      </span>
      <Button variant="outline" onClick={() => logout.mutate()} disabled={logout.isPending}>
        {logout.isPending ? 'Saindo…' : 'Sair'}
      </Button>
      {logout.isError && (
        <span role="alert" className="text-sm text-destructive">
          Não foi possível sair; tente de novo.
        </span>
      )}
    </div>
  );
}
