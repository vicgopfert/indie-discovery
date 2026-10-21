import { setTimeout as sleep } from 'node:timers/promises';
import { RateLimiter } from './rate-limiter';

function maxStartsInAnyWindow(starts: number[], windowMs: number) {
  return Math.max(
    ...starts.map((start) => starts.filter((s) => s >= start && s < start + windowMs).length),
  );
}

describe('RateLimiter', () => {
  // As tarefas medem o próprio início um pouco depois de liberadas; a folga de 50 ms
  // absorve esse atraso em máquinas lentas como a do CI.
  it('não inicia mais tarefas por janela do que o limite', async () => {
    const limiter = new RateLimiter({ requestsPerWindow: 3, windowMs: 500, maxConcurrent: 10 });
    const starts: number[] = [];

    await Promise.all(
      Array.from({ length: 9 }, () =>
        limiter.schedule(() => {
          starts.push(Date.now());
          return Promise.resolve();
        }),
      ),
    );

    expect(starts).toHaveLength(9);
    expect(maxStartsInAnyWindow(starts, 450)).toBeLessThanOrEqual(3);
    expect(Math.max(...starts) - Math.min(...starts)).toBeGreaterThanOrEqual(950);
  });

  it('não deixa mais tarefas abertas ao mesmo tempo do que o limite', async () => {
    const limiter = new RateLimiter({ requestsPerWindow: 100, windowMs: 1000, maxConcurrent: 2 });
    let running = 0;
    let maxRunning = 0;

    await Promise.all(
      Array.from({ length: 6 }, () =>
        limiter.schedule(async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await sleep(30);
          running--;
        }),
      ),
    );

    expect(maxRunning).toBe(2);
  });

  it('libera a vaga quando a tarefa falha', async () => {
    const limiter = new RateLimiter({ requestsPerWindow: 10, windowMs: 1000, maxConcurrent: 1 });

    await expect(limiter.schedule(() => Promise.reject(new Error('falhou')))).rejects.toThrow(
      'falhou',
    );
    await expect(limiter.schedule(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });
});
