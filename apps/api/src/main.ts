// Entrada provisória do B-01: só comprova que a API importa os contratos.
// Substituída pelo bootstrap do NestJS no B-02.
import { ApiErrorSchema, type ApiError } from '@indie/contracts';

const sample: ApiError = {
  statusCode: 404,
  error: 'Not Found',
  message: 'Jogo não encontrado',
  requestId: 'b01',
};

console.log('contracts ok:', ApiErrorSchema.parse(sample));
