import { CollectionDetailSchema, CollectionSummarySchema } from '@indie/contracts';
import { cache } from 'react';
import { apiFetch } from '@/lib/api-client';

export const listCollections = () =>
  apiFetch('/collections', { schema: CollectionSummarySchema.array() });

// Sem as coleções, a página que as mostra continua de pé: a falha vira null.
export const listCollectionsOrNull = () => listCollections().catch(() => null);

// A página e os metadados pedem a mesma página da coleção na mesma renderização: uma chamada só.
export const getCollection = cache((slug: string, page: number) =>
  apiFetch(`/collections/${encodeURIComponent(slug)}${page > 1 ? `?page=${page}` : ''}`, {
    schema: CollectionDetailSchema,
  }),
);
