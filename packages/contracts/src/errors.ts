import { z } from 'zod';

// Erros de validação trazem uma mensagem por campo, no formato "campo: mensagem".
export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.union([z.string(), z.array(z.string())]),
  requestId: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
