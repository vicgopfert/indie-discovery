import { describeFailure } from '../../common/background-tasks';
import { RESEND_EMAILS_URL, ResendMailer } from './resend-mailer';

const email = { to: 'jogadora@example.com', subject: 'Assunto', text: 'Texto' };

function mailerAnswering(status: number) {
  const fetchFn = jest.fn<Promise<Response>, Parameters<typeof fetch>>(() =>
    Promise.resolve(new Response('{"message":"jogadora@example.com"}', { status })),
  );
  const mailer = new ResendMailer(
    { apiKey: 're_teste', from: 'Penumbra <nao-responda@example.com>' },
    fetchFn,
  );
  return { mailer, fetchFn };
}

describe('ResendMailer', () => {
  it('envia só texto pela API HTTP, com a chave no cabeçalho', async () => {
    const { mailer, fetchFn } = mailerAnswering(200);

    await mailer.send(email);

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe(RESEND_EMAILS_URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer re_teste' });
    expect(JSON.parse(init?.body as string)).toEqual({
      from: 'Penumbra <nao-responda@example.com>',
      to: ['jogadora@example.com'],
      subject: 'Assunto',
      text: 'Texto',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('falha com o status quando o Resend recusa, sem repetir o corpo da resposta', async () => {
    const { mailer } = mailerAnswering(422);

    const failure = mailer.send(email);

    await expect(failure).rejects.toThrow('O Resend recusou o envio com o status 422');
    await expect(failure).rejects.not.toThrow('jogadora@example.com');
    await expect(failure).rejects.toMatchObject({ name: 'ResendRejectedError', code: 'HTTP_422' });
  });

  it('a falha no log mostra o status no código', async () => {
    const { mailer } = mailerAnswering(403);

    const error: unknown = await mailer.send(email).catch((failure: unknown) => failure);

    expect(describeFailure(error)).toBe('ResendRejectedError (HTTP_403)');
  });
});
