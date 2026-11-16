'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PROFILE_PATH } from '@/features/profile/paths';
import { UserAvatar } from '@/features/profile/user-avatar';
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
      {/* Abaixo de 640 px, só o avatar aparece; o nome continua no link para o leitor de tela. Acima,
          ele tem até 50 caracteres e é cortado com reticências. */}
      <Link
        href={PROFILE_PATH}
        title={user.displayName}
        className="flex items-center gap-2 rounded-md hover:underline"
      >
        <UserAvatar name={user.displayName} size="sm" />
        <span className="sr-only sm:not-sr-only sm:max-w-40 sm:truncate">{user.displayName}</span>
      </Link>
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
