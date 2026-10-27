import { STATUS_CODES } from 'node:http';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

const INTERNAL_ERROR_MESSAGE = 'Erro interno; tente novamente mais tarde';

// Todo erro sai como { statusCode, error, message, requestId }; o detalhe de um 5xx fica só no log.
@Catch()
export class ErrorResponseFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorResponseFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status >= 500;

    if (isServerError) {
      this.logger.error(
        { requestId: request.requestId, method: request.method, path: request.path },
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    http
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        error: STATUS_CODES[status] ?? 'Error',
        message:
          exception instanceof HttpException && !isServerError
            ? clientMessage(exception)
            : INTERNAL_ERROR_MESSAGE,
        requestId: request.requestId,
      });
  }
}

function clientMessage(exception: HttpException): unknown {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  return 'message' in body ? body.message : exception.message;
}
