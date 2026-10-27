import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

// O guard de sessão é global: toda rota exige login, menos as marcadas aqui.
export const Public = () => SetMetadata(IS_PUBLIC, true);
