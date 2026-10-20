import { z } from 'zod';

export const ApiErrorSchema = z.object({
  statusCode: z.number().int(),
  error: z.string(),
  message: z.string(),
  requestId: z.string(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
