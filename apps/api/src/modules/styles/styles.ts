import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { snippet, wholeTerm } from '../ingestion/collections/candidate-suggestions';

export const STYLE_CATEGORIES = ['gameplay', 'tone', 'setting'] as const;

// Uma palavra-chave pertence a um estilo só: a contribuição dela no motivo conta para um estilo.
export const stylesConfigSchema = z
  .object({
    rule: z.string().min(1),
    styles: z.array(
      z.object({
        slug: z.string().min(1),
        name: z.string().min(1),
        category: z.enum(STYLE_CATEGORIES),
        keywords: z.array(z.string().min(1)),
        summaryTerms: z.array(z.string().min(1)),
      }),
    ),
  })
  .refine(({ styles }) => new Set(styles.map((s) => s.slug)).size === styles.length, {
    error: 'Cada estilo precisa de um slug próprio.',
  })
  .refine(
    ({ styles }) => {
      const keywords = styles.flatMap((s) => s.keywords.map((k) => k.toLowerCase()));
      return new Set(keywords).size === keywords.length;
    },
    { error: 'Uma palavra-chave pertence a um estilo só.' },
  );

export type StylesConfig = z.infer<typeof stylesConfigSchema>;
export type CuratedStyle = StylesConfig['styles'][number];

export const STYLES_FILE = resolve(process.cwd(), 'config/styles.json');

export function readStylesConfig(file = STYLES_FILE): StylesConfig {
  return stylesConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export interface StyleSource {
  // Slugs das palavras-chave do jogo; as que não são de nenhum estilo são ignoradas.
  keywords: readonly string[];
  summary: string;
}

export interface StyleMatch {
  style: string;
  source: 'keyword' | 'summary';
  // A palavra-chave (slug) ou o termo do resumo que casou.
  term: string;
  // Só no resumo: o trecho em volta do termo.
  excerpt?: string;
}

// A palavra-chave casa pelo slug, como nas coleções, e o termo do resumo como palavra inteira, sem
// diferenciar maiúsculas. Um estilo pode casar pelos dois. Com a evidência, para a curadoria.
export function styleMatcher(styles: readonly CuratedStyle[]) {
  const compiled = styles.map((style) => ({
    slug: style.slug,
    keywords: new Set(style.keywords.map((k) => k.toLowerCase())),
    terms: style.summaryTerms.map((term) => ({ term, pattern: wholeTerm(term) })),
  }));

  return ({ keywords, summary }: StyleSource) =>
    compiled.flatMap((style): StyleMatch[] => {
      const keyword = keywords.find((k) => style.keywords.has(k.toLowerCase()));
      const matches: StyleMatch[] = keyword
        ? [{ style: style.slug, source: 'keyword', term: keyword }]
        : [];
      for (const { term, pattern } of style.terms) {
        const match = pattern.exec(summary);
        if (!match) continue;
        matches.push({
          style: style.slug,
          source: 'summary',
          term,
          excerpt: snippet(summary, match.index, match[0].length),
        });
        break;
      }
      return matches;
    });
}

// A mesma regra do styleMatcher, sem a evidência: os índices dos estilos do jogo, na ordem do
// arquivo, para a carga do índice. Uma expressão por estilo custava cerca de 1 s nos 22 mil
// resumos (B-74); aqui é uma passada por resumo, com todos os termos do mais longo ao mais curto e
// um grupo por termo. Depois de cada acerto a busca recomeça uma posição adiante, para achar o
// termo que começa dentro de outro, e os termos mais curtos que começam no mesmo ponto (prefixos
// do que casou) são conferidos à parte.
export function styleAssigner(styles: readonly CuratedStyle[]) {
  const styleByKeyword = new Map<string, number>();
  styles.forEach(({ keywords }, i) => {
    for (const keyword of keywords) styleByKeyword.set(keyword.toLowerCase(), i);
  });
  const terms = styles
    .flatMap(({ summaryTerms }, style) => summaryTerms.map((term) => ({ term, style })))
    .sort((a, b) => b.term.length - a.term.length);
  const summaryPattern =
    terms.length === 0
      ? null
      : new RegExp(
          `(?<![\\p{L}\\p{N}])(?:${terms.map(({ term }) => `(${escape(term)})`).join('|')})(?![\\p{L}\\p{N}])`,
          'giu',
        );
  const shorterAtStart = terms.map(({ term }) =>
    terms.flatMap((other) =>
      other.term.length < term.length && term.toLowerCase().startsWith(other.term.toLowerCase())
        ? [
            {
              style: other.style,
              pattern: new RegExp(`${escape(other.term)}(?![\\p{L}\\p{N}])`, 'iuy'),
            },
          ]
        : [],
    ),
  );

  return ({ keywords, summary }: StyleSource): number[] => {
    const found = new Set<number>();
    for (const keyword of keywords) {
      const style = styleByKeyword.get(keyword.toLowerCase());
      if (style !== undefined) found.add(style);
    }
    if (summaryPattern !== null) {
      summaryPattern.lastIndex = 0;
      for (let match = summaryPattern.exec(summary); match; match = summaryPattern.exec(summary)) {
        const matched = match.findIndex((group, i) => i > 0 && group !== undefined) - 1;
        found.add(terms[matched]!.style);
        for (const { style, pattern } of shorterAtStart[matched]!) {
          pattern.lastIndex = match.index;
          if (pattern.test(summary)) found.add(style);
        }
        summaryPattern.lastIndex = match.index + 1;
      }
    }
    return [...found].sort((a, b) => a - b);
  };
}

function escape(term: string) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
