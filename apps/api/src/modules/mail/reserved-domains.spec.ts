import { Logger } from '@nestjs/common';
import type { Email, Mailer } from './mailer';
import { isReservedAddress, SkipReservedDomains } from './reserved-domains';

const email = (to: string): Email => ({
  to,
  subject: 'Confirme o seu e-mail na Penumbra',
  text: '',
});

describe('domínios reservados a testes', () => {
  it.each([
    'conta@example.com',
    'conta@EXAMPLE.ORG',
    'conta@example.net',
    'conta@sub.example.com',
    'conta@penumbra.example',
    'conta@penumbra.test',
    'conta@penumbra.invalid',
    'conta@localhost',
  ])('%s é reservado', (address) => {
    expect(isReservedAddress(address)).toBe(true);
  });

  it.each([
    'conta@gmail.com',
    'conta@outlook.com',
    'conta@notexample.com',
    'conta@example.com.br',
    'conta@contest.com',
    'example.com@gmail.com',
  ])('%s não é reservado', (address) => {
    expect(isReservedAddress(address)).toBe(false);
  });

  describe('SkipReservedDomains', () => {
    const sent: Email[] = [];
    const inner: Mailer = { send: (message) => Promise.resolve(void sent.push(message)) };
    const mailer = new SkipReservedDomains(inner);

    beforeEach(() => (sent.length = 0));

    it('repassa o envio para endereço comum', async () => {
      await mailer.send(email('conta@gmail.com'));

      expect(sent).toEqual([email('conta@gmail.com')]);
    });

    it('não envia para domínio reservado e registra só o assunto, sem o destinatário', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

      await mailer.send(email('conta@example.com'));

      expect(sent).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        'Endereço de domínio reservado a testes; "Confirme o seu e-mail na Penumbra" não foi enviado',
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain('conta@example.com');
      warn.mockRestore();
    });
  });
});
