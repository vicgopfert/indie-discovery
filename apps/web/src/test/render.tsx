import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';

export function renderWithQuery(ui: ReactElement): RenderResult & { queryClient: QueryClient } {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const result = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...result, queryClient };
}

// Quem lê uma promessa com use() suspende no primeiro render: o act assíncrono espera a promessa e
// o render seguinte.
export async function renderAwaitingData(ui: ReactElement): Promise<RenderResult> {
  let result: RenderResult | undefined;
  await act(() => {
    result = render(ui);
    return Promise.resolve();
  });
  return result!;
}
