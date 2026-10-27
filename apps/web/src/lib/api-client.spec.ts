import { UserSchema } from '@indie/contracts';
import { describe, expect, it } from 'vitest';
import { apiError, sampleUser, stubFetch } from '@/test/fetch';
import { ApiRequestError, apiFetch, UNEXPECTED_ERROR_MESSAGE } from './api-client';

async function failure(promise: Promise<unknown>) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ApiRequestError);
  return error as ApiRequestError;
}

describe('apiFetch', () => {
  it('chama a API pela mesma origem, com o corpo em JSON', async () => {
    const fetchMock = stubFetch(() => Response.json(sampleUser));

    await apiFetch('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.c' },
      schema: UserSchema,
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.c' }),
    });
  });

  it('devolve o corpo validado pelo schema', async () => {
    stubFetch(() => Response.json(sampleUser));

    await expect(apiFetch('/auth/me', { schema: UserSchema })).resolves.toEqual(sampleUser);
  });

  it('sem schema, não lê o corpo', async () => {
    stubFetch(() => new Response(null, { status: 204 }));

    await expect(apiFetch('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('transforma o erro da API em ApiRequestError, com status, mensagem e requestId', async () => {
    stubFetch(() => apiError(409, 'E-mail já cadastrado'));

    const error = await failure(apiFetch('/auth/register', { method: 'POST' }));

    expect(error).toMatchObject({
      status: 409,
      messages: ['E-mail já cadastrado'],
      requestId: 'req-1',
    });
  });

  it('separa as mensagens de validação por campo', async () => {
    stubFetch(() => apiError(400, ['email: E-mail inválido.', 'password: Informe a senha.']));

    const error = await failure(apiFetch('/auth/register', { method: 'POST' }));

    expect(error.fieldMessages()).toEqual([
      { field: 'email', message: 'E-mail inválido.' },
      { field: 'password', message: 'Informe a senha.' },
    ]);
  });

  it.each([
    [
      'erro fora do formato da API',
      () => new Response('<html>Bad Gateway</html>', { status: 502 }),
    ],
    ['sucesso fora do contrato', () => Response.json({ id: 1 })],
    [
      'falha de rede',
      () => {
        throw new TypeError('Failed to fetch');
      },
    ],
  ])('%s vira a mensagem genérica', async (_, reply) => {
    stubFetch(reply);

    const error = await failure(apiFetch('/auth/me', { schema: UserSchema }));

    expect(error.messages).toEqual([UNEXPECTED_ERROR_MESSAGE]);
  });
});
