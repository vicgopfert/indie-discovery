import { ApiErrorSchema } from '@indie/contracts';
import type { z } from 'zod';

export const UNEXPECTED_ERROR_MESSAGE =
  'Não foi possível falar com o servidor; tente de novo em instantes.';

const FIELD_MESSAGE = /^(\w+): (.+)$/;

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly messages: string[],
    readonly requestId?: string,
  ) {
    super(messages.join(' '));
    this.name = 'ApiRequestError';
  }

  // Erros de validação da API chegam como "campo: mensagem", um por campo.
  fieldMessages(): { field: string; message: string }[] {
    return this.messages.flatMap((text) => {
      const match = FIELD_MESSAGE.exec(text);
      return match ? [{ field: match[1]!, message: match[2]! }] : [];
    });
  }
}

type RequestOptions = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown };

export function apiFetch(path: string, options?: RequestOptions): Promise<void>;
export function apiFetch<T>(
  path: string,
  options: RequestOptions & { schema: z.ZodType<T> },
): Promise<T>;
export async function apiFetch<T>(
  path: string,
  { schema, ...options }: RequestOptions & { schema?: z.ZodType<T> } = {},
): Promise<T | void> {
  const response = await send(path, options);
  if (!response.ok) throw await toError(response);
  if (!schema) return;

  const parsed = schema.safeParse(await readJson(response));
  if (!parsed.success) throw new ApiRequestError(response.status, [UNEXPECTED_ERROR_MESSAGE]);
  return parsed.data;
}

async function send(path: string, { method = 'GET', body }: RequestOptions) {
  const init: RequestInit = { method, credentials: 'same-origin' };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  try {
    return await fetch(`/api${path}`, init);
  } catch {
    throw new ApiRequestError(0, [UNEXPECTED_ERROR_MESSAGE]);
  }
}

async function toError(response: Response) {
  const parsed = ApiErrorSchema.safeParse(await readJson(response));
  if (!parsed.success) return new ApiRequestError(response.status, [UNEXPECTED_ERROR_MESSAGE]);
  const { message, requestId } = parsed.data;
  return new ApiRequestError(response.status, [message].flat(), requestId);
}

function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}
