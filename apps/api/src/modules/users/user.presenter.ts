import type { User as PublicUser } from '@indie/contracts';
import type { User } from '../../generated/prisma/client';

// O que sai da API sobre um usuário: nunca o hash da senha.
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    discoveryMode: user.discoveryMode,
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
