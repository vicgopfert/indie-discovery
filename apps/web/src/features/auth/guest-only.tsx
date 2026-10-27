'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useSession } from './hooks';

export function GuestOnly({ children }: { children: ReactNode }) {
  const { data: user } = useSession();
  if (!user) return children;

  return (
    <p>
      Você já entrou como <strong>{user.displayName}</strong>.{' '}
      <Link href="/" className="underline">
        Ir para o início
      </Link>
    </p>
  );
}
