import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { snippet, wholeTerm } from '../ingestion/collections/candidate-suggestions';

export const STYLE_CATEGORIES = ['gameplay', 'tone', 'setting'] as const;

export const stylesDraftSchema = z.object({
  status: z.string().min(1),
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
});

export type StylesDraft = z.infer<typeof stylesDraftSchema>;
export type DraftStyle = StylesDraft['styles'][number];

export const STYLES_DRAFT_FILE = resolve(process.cwd(), 'config/styles.draft.json');

export function readStylesDraft(file = STYLES_DRAFT_FILE): StylesDraft {
  return stylesDraftSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

export interface StyleMatch {
  style: string;
  source: 'keyword' | 'summary';
  // A palavra-chave (slug) ou o termo do resumo que casou.
  term: string;
  // Só no resumo: o trecho em volta do termo.
  excerpt?: string;
}

// Rascunho do B-73, só para medir: a palavra-chave casa pelo slug, como nas coleções, e o termo
// do resumo como palavra inteira, sem diferenciar maiúsculas. Um estilo pode casar pelos dois.
export function styleMatcher(styles: readonly DraftStyle[]) {
  const compiled = styles.map((style) => ({
    slug: style.slug,
    keywords: new Set(style.keywords.map((k) => k.toLowerCase())),
    terms: style.summaryTerms.map((term) => ({ term, pattern: wholeTerm(term) })),
  }));

  return ({ keywords, summary }: { keywords: readonly string[]; summary: string }) =>
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
