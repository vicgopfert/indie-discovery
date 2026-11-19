import { Logger } from '@nestjs/common';
import { BackgroundTasks, describeFailure } from './background-tasks';

describe('BackgroundTasks', () => {
  it('não roda a tarefa antes de quem a pediu terminar', async () => {
    const tasks = new BackgroundTasks();
    const order: string[] = [];

    tasks.run('tarefa', () => Promise.resolve(void order.push('tarefa')));
    order.push('resposta');
    await tasks.drain();

    expect(order).toEqual(['resposta', 'tarefa']);
  });

  it('registra a falha no log só com o tipo do erro, sem propagá-la', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const tasks = new BackgroundTasks();

    tasks.run('envio', () => Promise.reject(new TypeError('falhou para jogadora@example.com')));
    await tasks.drain();

    expect(error).toHaveBeenCalledWith('Falha em "envio": TypeError');
    expect(JSON.stringify(error.mock.calls)).not.toContain('jogadora@example.com');
    error.mockRestore();
  });

  it('espera também as tarefas criadas por outra tarefa', async () => {
    const tasks = new BackgroundTasks();
    let finished = false;

    tasks.run('primeira', () => {
      tasks.run('segunda', () => Promise.resolve(void (finished = true)));
      return Promise.resolve();
    });
    await tasks.drain();

    expect(finished).toBe(true);
  });
});

describe('describeFailure', () => {
  const withCode = (message: string, code: unknown, cause?: unknown) =>
    Object.assign(new Error(message, { cause }), { code });

  it.each([
    [
      'o código do erro',
      withCode('Unique constraint em jogadora@example.com', 'P2002'),
      'Error (P2002)',
    ],
    [
      'o código da causa',
      withCode('fetch failed', undefined, { code: 'ECONNREFUSED' }),
      'Error (ECONNREFUSED)',
    ],
    ['só o tipo, sem código', new RangeError('jogadora@example.com'), 'RangeError'],
    ['o tipo de um valor que não é Error', 'jogadora@example.com', 'string'],
  ])('mostra %s, nunca a mensagem', (_, error, expected) => {
    expect(describeFailure(error)).toBe(expected);
  });
});
