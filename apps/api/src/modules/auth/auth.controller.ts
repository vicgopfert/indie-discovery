import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type RegisterInput, RegisterSchema } from '@indie/contracts';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({
    schema: {
      example: { email: 'jogadora@example.com', displayName: 'Jogadora', password: 'senha-forte' },
    },
  })
  @ApiCreatedResponse({
    description: 'Conta criada; a senha nunca volta na resposta',
    schema: {
      example: {
        id: '2f0c…',
        email: 'jogadora@example.com',
        displayName: 'Jogadora',
        role: 'USER',
        discoveryMode: 'BALANCED',
        onboardingCompletedAt: null,
        createdAt: '2026-10-27T12:00:00.000Z',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'E-mail inválido, nome vazio ou senha fora de 8 a 128' })
  @ApiConflictResponse({ description: 'E-mail já cadastrado' })
  register(@Body({ schema: RegisterSchema }) body: RegisterInput) {
    return this.auth.register(body);
  }
}
