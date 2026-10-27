import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

// Só metadados: corpo, consulta, cookies e cabeçalhos ficam fora, porque levam senha e token.
export function logRequests(request: Request, response: Response, next: NextFunction) {
  const startedAt = performance.now();
  response.on('finish', () => {
    logger.log({
      requestId: request.requestId,
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
      ip: request.ip,
    });
  });
  next();
}
