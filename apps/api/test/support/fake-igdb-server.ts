import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

export type FakeReply = { status: number; body?: unknown; delayMs?: number } | 'drop-connection';

export interface ReceivedRequest {
  endpoint: string;
  body: string;
  clientId: string | undefined;
  authorization: string | undefined;
  receivedAt: number;
}

export class FakeIgdbServer {
  readonly requests: ReceivedRequest[] = [];
  tokenRequests = 0;
  tokenExpiresInSeconds = 3600;
  maxInFlight = 0;
  respond: (request: ReceivedRequest) => FakeReply = () => ({ status: 200, body: [] });

  private readonly queuedReplies: FakeReply[] = [];
  private inFlight = 0;
  private server: Server | undefined;

  replyOnce(...replies: FakeReply[]) {
    this.queuedReplies.push(...replies);
  }

  async start() {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    const { port } = this.server.address() as AddressInfo;
    return {
      apiUrl: `http://127.0.0.1:${port}/v4`,
      tokenUrl: `http://127.0.0.1:${port}/oauth2/token`,
    };
  }

  async stop() {
    this.server?.closeAllConnections();
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    const body = await readBody(req);
    if (req.url?.startsWith('/oauth2/token')) {
      this.tokenRequests++;
      return send(res, 200, {
        access_token: `token-${this.tokenRequests}`,
        expires_in: this.tokenExpiresInSeconds,
        token_type: 'bearer',
      });
    }

    const request: ReceivedRequest = {
      endpoint: req.url?.replace('/v4/', '') ?? '',
      body,
      clientId: req.headers['client-id'] as string | undefined,
      authorization: req.headers.authorization,
      receivedAt: Date.now(),
    };
    this.requests.push(request);
    this.inFlight++;
    this.maxInFlight = Math.max(this.maxInFlight, this.inFlight);
    try {
      const reply = this.queuedReplies.shift() ?? this.respond(request);
      if (reply === 'drop-connection') return req.socket.destroy();
      if (reply.delayMs) await sleep(reply.delayMs);
      send(res, reply.status, reply.body ?? []);
    } finally {
      this.inFlight--;
    }
  }
}

async function readBody(req: IncomingMessage) {
  let body = '';
  for await (const chunk of req) body += String(chunk);
  return body;
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}
