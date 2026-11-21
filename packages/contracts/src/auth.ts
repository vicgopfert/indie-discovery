import { z } from 'zod';

// O teto da senha evita gastar memória do Argon2 com entradas enormes.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const EmailSchema = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'E-mail inválido.' }).max(254, { error: 'E-mail longo demais.' }));

export const NewPasswordSchema = z
  .string({ error: 'Informe a senha.' })
  .min(PASSWORD_MIN_LENGTH, {
    error: `A senha tem no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`,
  })
  .max(PASSWORD_MAX_LENGTH, {
    error: `A senha tem no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
  });

export const RegisterSchema = z.object({
  email: EmailSchema,
  displayName: z
    .string({ error: 'Informe o nome de exibição.' })
    .trim()
    .min(1, { error: 'Informe o nome de exibição.' })
    .max(50, { error: 'O nome de exibição tem no máximo 50 caracteres.' }),
  password: NewPasswordSchema,
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const DISCOVERY_MODES = ['POPULAR', 'BALANCED', 'DISCOVERY'] as const;

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  discoveryMode: z.enum(DISCOVERY_MODES),
  onboardingCompletedAt: z.iso.datetime().nullable(),
  emailConfirmedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const UpdateMeSchema = z.object({
  discoveryMode: z.enum(DISCOVERY_MODES, {
    error: 'Modo deve ser POPULAR, BALANCED ou DISCOVERY.',
  }),
});

export type UpdateMeInput = z.infer<typeof UpdateMeSchema>;

// No login, a senha só precisa existir: a política de tamanho é do cadastro, e repeti-la aqui
// diria a quem tenta adivinhar quais senhas nem vale testar.
export const LoginSchema = z.object({
  email: EmailSchema,
  password: z
    .string({ error: 'Informe a senha.' })
    .min(1, { error: 'Informe a senha.' })
    .max(PASSWORD_MAX_LENGTH, { error: 'E-mail ou senha incorretos.' }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const PasswordResetRequestSchema = z.object({ email: EmailSchema });

export type PasswordResetRequestInput = z.infer<typeof PasswordResetRequestSchema>;

// Cada pedido novo invalida o link anterior; vai nos e-mails e nas mensagens de link inválido.
export const LATEST_LINK_NOTE =
  'Se você pediu mais de uma vez, só o link do e-mail mais recente funciona.';

// A mesma mensagem para link inexistente, vencido ou já usado.
export const INVALID_RESET_LINK_MESSAGE = `O link de redefinição é inválido ou expirou. Peça um novo. ${LATEST_LINK_NOTE}`;

export const PasswordResetConfirmSchema = z.object({
  token: z
    .string({ error: INVALID_RESET_LINK_MESSAGE })
    .min(1, { error: INVALID_RESET_LINK_MESSAGE })
    .max(128, { error: INVALID_RESET_LINK_MESSAGE }),
  password: NewPasswordSchema,
});

export type PasswordResetConfirmInput = z.infer<typeof PasswordResetConfirmSchema>;

// Como o token do link é apagado ao ser usado, a mesma mensagem cobre quem já confirmou.
export const INVALID_CONFIRMATION_LINK_MESSAGE = `O link de confirmação é inválido ou expirou. Se você já confirmou o seu e-mail, não precisa fazer nada; se não, entre na sua conta e peça um novo. ${LATEST_LINK_NOTE}`;

export const EmailConfirmationSchema = z.object({
  token: z
    .string({ error: INVALID_CONFIRMATION_LINK_MESSAGE })
    .min(1, { error: INVALID_CONFIRMATION_LINK_MESSAGE })
    .max(128, { error: INVALID_CONFIRMATION_LINK_MESSAGE }),
});

export type EmailConfirmationInput = z.infer<typeof EmailConfirmationSchema>;
