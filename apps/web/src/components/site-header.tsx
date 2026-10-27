import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { UserMenu } from '@/features/auth/user-menu';

export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="font-semibold">
          {siteConfig.name}
        </Link>
        <UserMenu />
      </div>
    </header>
  );
}
