import { z } from 'zod';

// Formato único de erro produzido pelo filtro global de exceções (seção 5).
export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  requestId: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
