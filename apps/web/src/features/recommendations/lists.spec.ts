import { describe, expect, it } from 'vitest';
import { listHref, listKeyOf, listSegment, listTitle, parseListPage } from './lists';

const horror = { type: 'THEME', slug: 'horror', name: 'Terror', title: 'Terror' } as const;

describe('listas na URL', () => {
  it.each([
    ['main', 'para-voce'],
    ['upcoming', 'em-breve'],
    ['game:hollow-knight', 'jogo-hollow-knight'],
    ['genre:role-playing-rpg', 'genero-role-playing-rpg'],
    ['theme:horror', 'tema-horror'],
    ['tag:bullet-hell', 'etiqueta-bullet-hell'],
  ])('a chave %s vira o segmento %s e volta', (key, segment) => {
    expect(listSegment(key)).toBe(segment);
    expect(listKeyOf(segment)).toBe(key);
  });

  it.each([
    'main',
    'upcoming',
    'genero',
    'genero-',
    'keyword-roguelite',
    'tema:horror',
    'constructor',
    '',
  ])('o segmento "%s" não é lista nenhuma', (segment) => {
    expect(listKeyOf(segment)).toBeNull();
  });

  it('o endereço leva a página só a partir da segunda', () => {
    expect(listHref('theme:horror')).toBe('/recomendacoes/tema-horror');
    expect(listHref('theme:horror', 1)).toBe('/recomendacoes/tema-horror');
    expect(listHref('main', 3)).toBe('/recomendacoes/para-voce?page=3');
  });

  it('a página inválida vira a primeira', () => {
    expect(parseListPage('4')).toBe(4);
    expect(parseListPage(undefined)).toBe(1);
    expect(parseListPage('0')).toBe(1);
    expect(parseListPage('abc')).toBe(1);
    expect(parseListPage('2.5')).toBe(1);
    expect(parseListPage('1001')).toBe(1);
    expect(parseListPage(['2', '3'])).toBe(1);
  });

  it('monta o título pelo tipo da lista, pelo título do atributo e pelo jogo de origem', () => {
    expect(listTitle('main')).toBe('Para você');
    expect(listTitle('upcoming')).toBe('Em breve no seu gosto');
    expect(listTitle('theme:horror', { feature: horror })).toBe('Porque você curte Terror');
    expect(
      listTitle('tag:difficult', {
        feature: { type: 'TAG', slug: 'difficult', name: 'Impiedoso', title: 'jogos difíceis' },
      }),
    ).toBe('Porque você curte jogos difíceis');
    expect(
      listTitle('game:hollow-knight', {
        feature: null,
        game: { slug: 'hollow-knight', name: 'Hollow Knight', inCatalog: true },
      }),
    ).toBe('Porque você gostou de Hollow Knight');
    expect(listTitle('theme:horror')).toBe('Recomendações');
    expect(listTitle('game:hollow-knight')).toBe('Recomendações');
  });
});
