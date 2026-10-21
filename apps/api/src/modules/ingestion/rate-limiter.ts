export interface RateLimit {
  requestsPerWindow: number;
  windowMs: number;
  maxConcurrent: number;
}

export class RateLimiter {
  private readonly queue: (() => void)[] = [];
  private readonly recentStarts: number[] = [];
  private running = 0;
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly limit: RateLimit) {}

  async schedule<T>(task: () => Promise<T>): Promise<T> {
    await new Promise<void>((start) => {
      this.queue.push(start);
      this.drain();
    });
    try {
      return await task();
    } finally {
      this.running--;
      this.drain();
    }
  }

  private drain() {
    const now = Date.now();
    while (this.recentStarts.length > 0 && now - this.recentStarts[0]! >= this.limit.windowMs) {
      this.recentStarts.shift();
    }

    while (this.queue.length > 0 && this.hasFreeSlot()) {
      this.running++;
      this.recentStarts.push(now);
      this.queue.shift()!();
    }

    const waitingOnlyForWindow = this.queue.length > 0 && this.running < this.limit.maxConcurrent;
    if (waitingOnlyForWindow && this.timer === undefined) {
      const windowFreesAt = this.recentStarts[0]! + this.limit.windowMs;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        this.drain();
      }, windowFreesAt - now);
    }
  }

  private hasFreeSlot() {
    return (
      this.running < this.limit.maxConcurrent &&
      this.recentStarts.length < this.limit.requestsPerWindow
    );
  }
}
