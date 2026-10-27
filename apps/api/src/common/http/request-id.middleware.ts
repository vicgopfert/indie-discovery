import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export const REQUEST_ID_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[\w-]{8,64}$/;

// Aceita o id de quem chamou só se for seguro para o log; senão gera um novo.
export function assignRequestId(request: Request, response: Response, next: NextFunction) {
  const incoming = request.get(REQUEST_ID_HEADER);
  request.requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  response.setHeader(REQUEST_ID_HEADER, request.requestId);
  next();
}
