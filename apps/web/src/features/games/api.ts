import { GameDetailSchema } from '@indie/contracts';
import { cache } from 'react';
import { apiFetch } from '@/lib/api-client';

// A página e os metadados pedem o mesmo jogo na mesma renderização: uma chamada só.
export const getGame = cache((slug: string) =>
  apiFetch(`/games/${encodeURIComponent(slug)}`, { schema: GameDetailSchema }),
);
