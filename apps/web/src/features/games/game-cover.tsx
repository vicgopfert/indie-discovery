import Image from 'next/image';
import { type IgdbImageSize, igdbImageUrl } from '@/lib/igdb';
import { cn } from '@/lib/utils';

// fluid ocupa a largura do elemento pai, na proporção da capa.
const SIZES = {
  small: { width: 90, height: 128, image: 'cover_small_2x', fluid: false },
  big: { width: 264, height: 374, image: 'cover_big_2x', fluid: false },
  fluid: { width: 264, height: 374, image: 'cover_big_2x', fluid: true },
} satisfies Record<string, { width: number; height: number; image: IgdbImageSize; fluid: boolean }>;

// O nome do jogo sempre aparece ao lado ou no link, então a capa é decorativa para leitores de tela.
export function GameCover({
  name,
  coverImageId,
  size,
  preload = false,
}: {
  name: string;
  coverImageId: string;
  size: keyof typeof SIZES;
  preload?: boolean;
}) {
  const { width, height, image, fluid } = SIZES[size];
  if (!coverImageId) {
    return (
      <div
        aria-hidden="true"
        style={fluid ? undefined : { width, height }}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md bg-muted p-2 text-center text-xs text-muted-foreground',
          fluid && 'aspect-264/374 w-full',
        )}
      >
        {name}
      </div>
    );
  }
  return (
    <Image
      src={igdbImageUrl(coverImageId, image)}
      alt=""
      width={width}
      height={height}
      preload={preload}
      unoptimized
      className={cn(
        'shrink-0 rounded-md bg-muted object-cover',
        fluid && 'aspect-264/374 h-auto w-full',
      )}
    />
  );
}
