import { type BeforeApplicationShutdown, Injectable, Logger } from '@nestjs/common';
import { setImmediate } from 'node:timers/promises';

// Só o tipo e o código: a mensagem de um erro pode repetir os dados da tarefa, como um endereço
// de e-mail.
export function describeFailure(error: unknown) {
  if (!(error instanceof Error)) return typeof error;
  const { code } = error as { code?: unknown };
  const { code: causeCode } = (error.cause ?? {}) as { code?: unknown };
  const reason = [code, causeCode].find(isErrorCode);
  return reason === undefined ? error.name : `${error.name} (${reason})`;
}

const isErrorCode = (value: unknown): value is string | number =>
  typeof value === 'string' || typeof value === 'number';

// Trabalho que roda depois da resposta, para que o tempo de resposta não dependa dele. A falha
// fica no log, com o nome da tarefa, e nunca chega a quem fez o pedido. No desligamento, a espera
// vem antes de o banco ser desconectado, no último passo (PrismaService).
@Injectable()
export class BackgroundTasks implements BeforeApplicationShutdown {
  private readonly logger = new Logger('BackgroundTasks');
  private readonly running = new Set<Promise<void>>();

  run(name: string, task: () => Promise<void>) {
    const promise = setImmediate()
      .then(task)
      .catch((error: unknown) => this.logger.error(`Falha em "${name}": ${describeFailure(error)}`))
      .finally(() => this.running.delete(promise));
    this.running.add(promise);
  }

  async drain() {
    while (this.running.size > 0) await Promise.all(this.running);
  }

  beforeApplicationShutdown() {
    return this.drain();
  }
}
