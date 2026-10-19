// Provisório do B-01: só comprova que o frontend importa os contratos.
// Substituído pelo projeto Next.js no B-02.
import { ApiErrorSchema, type ApiError } from '@indie/contracts';

export function parseApiError(body: unknown): ApiError | null {
  const result = ApiErrorSchema.safeParse(body);
  return result.success ? result.data : null;
}
