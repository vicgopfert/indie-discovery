import { describe, expect, it } from 'vitest';
import { igdbImageUrl } from './igdb';

describe('igdbImageUrl', () => {
  it('monta a URL da CDN da IGDB com o tamanho pedido', () => {
    expect(igdbImageUrl('co3byy', 'cover_small_2x')).toBe(
      'https://images.igdb.com/igdb/image/upload/t_cover_small_2x/co3byy.jpg',
    );
  });
});
