import { LATEST_LINK_NOTE } from '@indie/contracts';
import type { Email } from '../mail/mailer';

export const PASSWORD_RESET_TTL_MINUTES = 60;
export const EMAIL_CONFIRMATION_TTL_DAYS = 7;

// Nenhum texto digitado pelo usuário entra em e-mail de conta: a confirmação vai para um endereço
// ainda não confirmado, e quem cadastra o endereço de outra pessoa faria a Penumbra entregar o
// texto dele, como um nome de exibição com um golpe.
const GREETING = 'Olá.';

// O token vai depois do #: o navegador não o envia ao servidor, então ele não chega aos logs.
export function passwordResetLink(webOrigin: string, token: string) {
  return `${webOrigin}/redefinir-senha#${token}`;
}

export function emailConfirmationLink(webOrigin: string, token: string) {
  return `${webOrigin}/confirmar-email#${token}`;
}

export function passwordResetEmail(to: string, link: string): Email {
  return {
    to,
    subject: 'Redefinição de senha da Penumbra',
    text: [
      GREETING,
      '',
      'Recebemos um pedido para redefinir a senha da sua conta na Penumbra. Para escolher uma ' +
        `senha nova, abra o link abaixo. Ele vale por ${PASSWORD_RESET_TTL_MINUTES} minutos e só ` +
        `pode ser usado uma vez. ${LATEST_LINK_NOTE}`,
      '',
      link,
      '',
      'Se você não pediu a redefinição, ignore este e-mail: a sua senha continua a mesma.',
      '',
      'Penumbra',
    ].join('\n'),
  };
}

const BRASILIA_TIME = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function passwordChangedEmail(to: string, changedAt: Date, webOrigin: string): Email {
  return {
    to,
    subject: 'A sua senha da Penumbra foi alterada',
    text: [
      GREETING,
      '',
      `A senha da sua conta na Penumbra foi alterada em ${BRASILIA_TIME.format(changedAt)} ` +
        '(horário de Brasília), e todas as sessões abertas foram encerradas.',
      '',
      'Se foi você, não precisa fazer nada. Se não foi, peça uma nova redefinição em ' +
        `${webOrigin}/esqueci-senha e troque também a senha do seu e-mail.`,
      '',
      'Penumbra',
    ].join('\n'),
  };
}

const CONFIRMATION_INSTRUCTIONS = `Ele vale por ${EMAIL_CONFIRMATION_TTL_DAYS} dias. ${LATEST_LINK_NOTE}`;

const UNCONFIRMED_CONSEQUENCE =
  'Enquanto o e-mail não for confirmado, a Penumbra não envia para este endereço links de ' +
  'redefinição de senha nem avisos da conta.';

export function emailConfirmationEmail(to: string, link: string): Email {
  return {
    to,
    subject: 'Confirme o seu e-mail na Penumbra',
    text: [
      GREETING,
      '',
      'Para confirmar que este é o e-mail da sua conta na Penumbra, abra o link abaixo. ' +
        CONFIRMATION_INSTRUCTIONS,
      '',
      link,
      '',
      UNCONFIRMED_CONSEQUENCE,
      '',
      'Se você não criou uma conta na Penumbra, ignore este e-mail.',
      '',
      'Penumbra',
    ].join('\n'),
  };
}

// Conta não confirmada que pediu a redefinição: o link que dá acesso à conta só vai para um
// endereço confirmado, então primeiro vem a confirmação.
export function confirmBeforeResetEmail(to: string, link: string): Email {
  return {
    to,
    subject: 'Redefinição de senha da Penumbra: confirme o seu e-mail antes',
    text: [
      GREETING,
      '',
      'Recebemos um pedido para redefinir a senha da sua conta na Penumbra, mas o e-mail dela ' +
        'ainda não foi confirmado. Abra o link abaixo para confirmar e, depois, peça a ' +
        `redefinição de novo. ${CONFIRMATION_INSTRUCTIONS}`,
      '',
      link,
      '',
      'Se você não pediu a redefinição, ignore este e-mail: a sua senha continua a mesma.',
      '',
      'Penumbra',
    ].join('\n'),
  };
}
