import {
  confirmBeforeResetEmail,
  emailConfirmationEmail,
  emailConfirmationLink,
  passwordChangedEmail,
  passwordResetEmail,
  passwordResetLink,
} from './account-emails';

const ORIGIN = 'https://penumbraindie.com.br';
const CHANGED_AT = new Date('2026-11-17T18:30:00Z');

describe('e-mails de conta', () => {
  it.each([
    ['pedido de redefinição', passwordResetEmail('jogadora@example.com', 'https://link')],
    ['senha alterada', passwordChangedEmail('jogadora@example.com', CHANGED_AT, ORIGIN)],
    ['confirmação do e-mail', emailConfirmationEmail('jogadora@example.com', 'https://link')],
    [
      'confirmação antes da redefinição',
      confirmBeforeResetEmail('jogadora@example.com', 'https://link'),
    ],
  ])('%s: saudação genérica, sem texto digitado pelo usuário', (_, email) => {
    expect(email.text.startsWith('Olá.\n')).toBe(true);
    expect(email.to).toBe('jogadora@example.com');
    expect(email.text).not.toContain('jogadora@example.com');
  });

  it('o link de redefinição leva o token depois do #', () => {
    const link = passwordResetLink(ORIGIN, 'token-secreto');

    expect(link).toBe(`${ORIGIN}/redefinir-senha#token-secreto`);
    expect(passwordResetEmail('jogadora@example.com', link).text).toContain(link);
  });

  it('o pedido de redefinição avisa que só o link mais recente funciona', () => {
    expect(passwordResetEmail('jogadora@example.com', 'https://link').text).toContain(
      'Se você pediu mais de uma vez, só o link do e-mail mais recente funciona.',
    );
  });

  it('o link de confirmação leva o token depois do #', () => {
    const link = emailConfirmationLink(ORIGIN, 'token-secreto');

    expect(link).toBe(`${ORIGIN}/confirmar-email#token-secreto`);
    expect(emailConfirmationEmail('jogadora@example.com', link).text).toContain(link);
    expect(confirmBeforeResetEmail('jogadora@example.com', link).text).toContain(link);
  });

  it.each([
    ['confirmação do e-mail', emailConfirmationEmail('jogadora@example.com', 'https://link')],
    [
      'confirmação antes da redefinição',
      confirmBeforeResetEmail('jogadora@example.com', 'https://link'),
    ],
  ])('%s: vale 7 dias e só o link mais recente funciona', (_, email) => {
    expect(email.text).toContain('Ele vale por 7 dias.');
    expect(email.text).toContain(
      'Se você pediu mais de uma vez, só o link do e-mail mais recente funciona.',
    );
  });

  it('a confirmação diz o que acontece sem ela e o que fazer se a conta não for sua', () => {
    const { text } = emailConfirmationEmail('jogadora@example.com', 'https://link');

    expect(text).toContain('não envia para este endereço links de redefinição de senha');
    expect(text).toContain('Se você não criou uma conta na Penumbra, ignore este e-mail.');
  });

  it('a confirmação antes da redefinição pede para repetir o pedido depois de confirmar', () => {
    const email = confirmBeforeResetEmail('jogadora@example.com', 'https://link');

    expect(email.subject).toBe('Redefinição de senha da Penumbra: confirme o seu e-mail antes');
    expect(email.text).toContain('peça a redefinição de novo');
    expect(email.text).not.toContain('/redefinir-senha#');
  });

  it('a data da troca de senha sai no horário de Brasília', () => {
    expect(passwordChangedEmail('jogadora@example.com', CHANGED_AT, ORIGIN).text).toContain(
      '17 de novembro de 2026 às 15:30',
    );
  });
});
