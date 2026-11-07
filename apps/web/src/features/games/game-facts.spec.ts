import type { GameLanguage } from '@indie/contracts';
import { describe, expect, it } from 'vitest';
import {
  companyNames,
  countrySource,
  languageSupport,
  metaDescription,
  portugueseSupport,
  tagAttribution,
} from './game-facts';

const language = (locale: string, name: string, support: Partial<GameLanguage> = {}) => ({
  locale,
  name,
  interface: false,
  subtitles: false,
  audio: false,
  ...support,
});

const english = language('en-US', 'Inglês', { interface: true, subtitles: true, audio: true });

describe('languageSupport', () => {
  it('lista os tipos de suporte em português', () => {
    expect(languageSupport(english)).toBe('Inglês: interface, legendas e áudio');
    expect(languageSupport(language('pt-BR', 'Português (Brasil)', { audio: true }))).toBe(
      'Português (Brasil): áudio',
    );
  });

  it('sem tipo informado, mostra só o idioma', () => {
    expect(languageSupport(language('ja-JP', 'Japonês'))).toBe('Japonês');
  });
});

describe('portugueseSupport', () => {
  it('mostra cada variante de português com o suporte', () => {
    expect(
      portugueseSupport([
        english,
        language('pt-BR', 'Português (Brasil)', { interface: true, subtitles: true }),
        language('pt-PT', 'Português (Portugal)', { subtitles: true }),
      ]),
    ).toEqual(['Português (Brasil): interface e legendas', 'Português (Portugal): legendas']);
  });

  it('com idiomas informados e nenhum português, diz que não tem', () => {
    expect(portugueseSupport([english])).toEqual(['Sem português']);
  });

  it('sem nenhum idioma, diz que não foi informado', () => {
    expect(portugueseSupport([])).toEqual(['Idiomas não informados']);
  });
});

describe('companyNames', () => {
  it('junta os nomes ou diz que não foi informado', () => {
    expect(companyNames(['Extremely OK Games', 'Maddy Makes Games'])).toBe(
      'Extremely OK Games e Maddy Makes Games',
    );
    expect(companyNames([])).toBe('Não informado');
  });
});

describe('countrySource', () => {
  it('diz de onde veio o país', () => {
    expect(countrySource({ code: 'JP', name: 'Japão', source: 'WIKIDATA' })).toBe(
      'fonte: Wikidata',
    );
  });
});

describe('tagAttribution', () => {
  const tags = [{ slug: 'roguelike', name: 'Roguelike' }];

  it('cita a comunidade Steam e leva à página do jogo na loja', () => {
    expect(tagAttribution({ tags, tagSource: 'STEAM', steamAppId: 1145360 })).toEqual({
      text: 'Etiquetas da comunidade Steam',
      href: 'https://store.steampowered.com/app/1145360',
    });
  });

  it('as da reserva dizem que vieram da IGDB, sem link', () => {
    expect(tagAttribution({ tags, tagSource: 'IGDB', steamAppId: 1145360 })).toEqual({
      text: 'Etiquetas atribuídas pelo resumo e pelas palavras-chave da IGDB',
      href: null,
    });
  });

  it('sem etiquetas, não há atribuição', () => {
    expect(tagAttribution({ tags: [], tagSource: null, steamAppId: null })).toBeNull();
  });
});

describe('metaDescription', () => {
  it('mantém o resumo curto como está, sem quebras de linha', () => {
    expect(metaDescription('Um jogo\n\nsobre  escalar.')).toBe('Um jogo sobre escalar.');
  });

  it('corta o resumo longo na última palavra inteira', () => {
    const description = metaDescription('palavra '.repeat(40));

    expect(description.length).toBeLessThanOrEqual(160);
    expect(description).toMatch(/palavra…$/);
  });
});
