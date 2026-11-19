export const MAILER = Symbol('MAILER');

// Só texto: sem HTML não há imagem nem link reescrito que rastreie abertura ou clique.
export interface Email {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}
