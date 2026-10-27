import { describe, expect, it } from 'vitest';
import { safeRedirect, withRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it.each(['/', '/jogos/celeste', '/catalogo?genero=rpg#lista'])(
    'aceita o caminho interno %s',
    (path) => {
      expect(safeRedirect(path)).toBe(path);
    },
  );

  it.each([
    ['ausente', undefined],
    ['repetido na URL', ['/a', '/b']],
    ['endereço absoluto', 'https://atacante.example'],
    ['sem protocolo', '//atacante.example'],
    ['com barra invertida', '/\\atacante.example'],
    ['com tabulação no meio', '/\t/atacante.example'],
    ['javascript:', 'javascript:alert(1)'],
    ['relativo', 'perfil'],
  ])('recusa destino %s e volta para o início', (_, target) => {
    expect(safeRedirect(target)).toBe('/');
  });
});

describe('withRedirect', () => {
  it('leva o destino adiante, codificado', () => {
    expect(withRedirect('/entrar', '/catalogo?genero=rpg')).toBe(
      '/entrar?next=%2Fcatalogo%3Fgenero%3Drpg',
    );
  });

  it('omite o destino quando é o início', () => {
    expect(withRedirect('/entrar', '/')).toBe('/entrar');
  });
});
