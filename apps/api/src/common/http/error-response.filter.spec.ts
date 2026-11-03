import {
  type ArgumentsHost,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ErrorResponseFilter } from './error-response.filter';

function hostFor() {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = { requestId: 'req-12345678', method: 'POST', path: '/api/x' };
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('ErrorResponseFilter', () => {
  const filter = new ErrorResponseFilter();
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => logError.mockRestore());

  it('mantém a mensagem e o status de um erro HTTP, com o requestId', () => {
    const { host, response } = hostFor();

    filter.catch(new ConflictException('E-mail já cadastrado'), host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 409,
      error: 'Conflict',
      message: 'E-mail já cadastrado',
      requestId: 'req-12345678',
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it('mantém a lista de mensagens da validação', () => {
    const { host, response } = hostFor();

    filter.catch(new BadRequestException(['email: Invalid email address']), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: ['email: Invalid email address'] }),
    );
  });

  it('mantém a mensagem de um 503 lançado de propósito e o registra como aviso', () => {
    const { host, response } = hostFor();
    const logWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    filter.catch(new ServiceUnavailableException('Índice carregando'), host);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 503,
      error: 'Service Unavailable',
      message: 'Índice carregando',
      requestId: 'req-12345678',
    });
    expect(logWarn).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-12345678', status: 503 }),
    );
    expect(logError).not.toHaveBeenCalled();
    logWarn.mockRestore();
  });

  it('esconde a mensagem de um 500, mesmo lançado como erro HTTP', () => {
    const { host, response } = hostFor();

    filter.catch(new InternalServerErrorException('consulta com a senha do banco'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Erro interno; tente novamente mais tarde',
      }),
    );
    expect(logError).toHaveBeenCalled();
  });

  it('esconde o detalhe de um erro inesperado e o registra no log', () => {
    const { host, response } = hostFor();

    filter.catch(new Error('connection refused em 10.0.0.5:5432'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Erro interno; tente novamente mais tarde',
      requestId: 'req-12345678',
    });
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: 'req-12345678' }),
      expect.stringContaining('connection refused'),
    );
  });
});
