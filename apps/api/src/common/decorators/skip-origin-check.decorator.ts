import { SetMetadata } from '@nestjs/common';

export const SKIP_ORIGIN_CHECK = 'skipOriginCheck';

// Só para rota chamada de servidor para servidor, autenticada por segredo e sem cookie: sem cookie
// não há CSRF a evitar, e quem chama não manda Origin.
export const SkipOriginCheck = () => SetMetadata(SKIP_ORIGIN_CHECK, true);
