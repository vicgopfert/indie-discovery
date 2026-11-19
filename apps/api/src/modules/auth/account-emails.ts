import { LATEST_RESET_LINK_NOTE } from '@indie/contracts';
import type { Email } from '../mail/mailer';

export const PASSWORD_RESET_TTL_MINUTES = 60;

// Nenhum texto digitado pelo usuário entra em e-mail de conta: sem confirmação do e-mail, quem
// cadastra o endereço de outra pessoa faria a Penumbra entregar o texto dele, como um nome de
// exibição com um golpe.
const GREETING = 'Olá.';

// O token vai depois do #: o navegador não o envia ao servidor, então ele não chega aos logs.
export function passwordResetLink(webOrigin: string, token: string) {
  return `${webOrigin}/redefinir-senha#${token}`;
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
        `pode ser usado uma vez. ${LATEST_RESET_LINK_NOTE}`,
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
