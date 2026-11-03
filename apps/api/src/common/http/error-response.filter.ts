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

// Todo erro sai como { statusCode, error, message, requestId }. O detalhe de um erro inesperado ou
// de um 500 fica só no log; um 5xx lançado de propósito, como o 503 do índice ainda carregando,
// leva a mensagem dele.
@Catch()
export class ErrorResponseFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorResponseFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status >= 500;
    const isIntentional = exception instanceof HttpException && status !== 500;

    if (isServerError && isIntentional) {
      this.logger.warn({
        requestId: request.requestId,
        method: request.method,
        path: request.path,
        status,
        message: clientMessage(exception),
      });
    } else if (isServerError) {
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
        message: isIntentional ? clientMessage(exception) : INTERNAL_ERROR_MESSAGE,
        requestId: request.requestId,
      });
  }
}

function clientMessage(exception: HttpException): unknown {
  const body = exception.getResponse();
  if (typeof body === 'string') return body;
  return 'message' in body ? body.message : exception.message;
}
