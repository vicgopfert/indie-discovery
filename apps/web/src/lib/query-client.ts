import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api-client';

const MAX_RETRIES = 2;

// Um 4xx não muda se repetido; só falhas de rede e do servidor valem nova tentativa.
export function shouldRetry(failureCount: number, error: unknown) {
  const isClientError =
    error instanceof ApiRequestError && error.status >= 400 && error.status < 500;
  return !isClientError && failureCount < MAX_RETRIES;
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: shouldRetry, staleTime: 60_000 } },
  });
}
