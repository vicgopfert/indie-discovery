import type { Email, Mailer } from '../../src/modules/mail/mailer';

// Guarda os e-mails em vez de enviá-los. hold() trava os envios até a função devolvida ser chamada.
export class FakeMailer implements Mailer {
  readonly sent: Email[] = [];
  private gate: Promise<void> = Promise.resolve();

  async send(email: Email) {
    await this.gate;
    this.sent.push(email);
  }

  hold() {
    let release!: () => void;
    this.gate = new Promise((resolve) => (release = resolve));
    return () => {
      this.gate = Promise.resolve();
      release();
    };
  }

  clear() {
    this.sent.length = 0;
  }
}
