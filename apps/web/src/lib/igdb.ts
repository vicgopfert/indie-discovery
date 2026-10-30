// Tamanhos que a própria CDN da IGDB serve; "_2x" é a versão para telas de alta densidade.
export type IgdbImageSize = 'cover_small' | 'cover_small_2x' | 'cover_big' | 'cover_big_2x';

export const igdbImageUrl = (imageId: string, size: IgdbImageSize) =>
  `https://images.igdb.com/igdb/image/upload/t_${size}/${imageId}.jpg`;
