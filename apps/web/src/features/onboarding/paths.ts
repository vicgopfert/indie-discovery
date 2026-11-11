import { withRedirect } from '@/lib/safe-redirect';

export const ONBOARDING_PATH = '/boas-vindas';

// Ao fim da partida a frio, a pessoa segue para onde ia: a ficha de onde veio, por exemplo.
export const onboardingHref = (next: string) => withRedirect(ONBOARDING_PATH, next);
