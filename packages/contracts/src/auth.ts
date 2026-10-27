import { z } from 'zod';

// O teto da senha evita gastar memória do Argon2 com entradas enormes.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const EmailSchema = z
  .string({ error: 'Informe o e-mail.' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'E-mail inválido.' }).max(254, { error: 'E-mail longo demais.' }));

export const RegisterSchema = z.object({
  email: EmailSchema,
  displayName: z
    .string({ error: 'Informe o nome de exibição.' })
    .trim()
    .min(1, { error: 'Informe o nome de exibição.' })
    .max(50, { error: 'O nome de exibição tem no máximo 50 caracteres.' }),
  password: z
    .string({ error: 'Informe a senha.' })
    .min(PASSWORD_MIN_LENGTH, {
      error: `A senha tem no mínimo ${PASSWORD_MIN_LENGTH} caracteres.`,
    })
    .max(PASSWORD_MAX_LENGTH, {
      error: `A senha tem no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
    }),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(['USER', 'ADMIN']),
  discoveryMode: z.enum(['POPULAR', 'BALANCED', 'DISCOVERY']),
  onboardingCompletedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;

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
