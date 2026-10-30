import Image from 'next/image';
import { type IgdbImageSize, igdbImageUrl } from '@/lib/igdb';

const SIZES = {
  small: { width: 90, height: 128, image: 'cover_small_2x' },
  big: { width: 264, height: 374, image: 'cover_big_2x' },
} satisfies Record<string, { width: number; height: number; image: IgdbImageSize }>;

// O nome do jogo sempre aparece ao lado, então a capa é decorativa para leitores de tela.
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
  const { width, height, image } = SIZES[size];
  if (!coverImageId) {
    return (
      <div
        aria-hidden="true"
        style={{ width, height }}
        className="flex shrink-0 items-center justify-center rounded-md bg-muted p-2 text-center text-xs text-muted-foreground"
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
      className="shrink-0 rounded-md bg-muted object-cover"
    />
  );
}
