import { cn } from '@/lib/utils';
import { initials } from './initials';

const SIZES = { sm: 'size-8 text-xs', lg: 'size-16 text-xl' };

// Decorativo: o nome sempre aparece ao lado, ou no texto do link, para o leitor de tela.
export function UserAvatar({ name, size }: { name: string; size: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground select-none',
        SIZES[size],
      )}
    >
      {initials(name)}
    </span>
  );
}
