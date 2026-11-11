import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { FeatureType, TagSource } from '../../generated/prisma/client';
import { snippet, wholeTerm } from '../ingestion/collections/candidate-suggestions';
import { slugify } from '../ingestion/igdb/igdb.mapper';
import type { MappedFeature } from '../ingestion/model/mapped-game';
import type { SteamTag } from './steam-store.client';

// Grupos da documentação da Steam (Tag Wizard). Os de jogadores, recursos técnicos e opinião não
// entram no vocabulário; o visual entra na ficha e no filtro, mas não vira interesse. A mecânica
// (mundo aberto, construção de baralho) separa o que descreve o jogo dos recursos técnicos.
export const TAG_GROUPS = [
  'genre',
  'subgenre',
  'mechanic',
  'mood',
  'theme',
  'visual',
  'players',
  'feature',
  'assessment',
  'other',
] as const;

export type TagGroup = (typeof TAG_GROUPS)[number];

// Uma palavra-chave da IGDB é evidência de reserva para uma etiqueta só, como nos estilos.
export const tagVocabularySchema = z
  .object({
    rule: z.string().min(1),
    minRelativeWeight: z.number().positive().max(1),
    minRelativeWeightRationale: z.string().min(1),
    tags: z.array(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1),
        englishName: z.string().min(1),
        group: z.enum(TAG_GROUPS),
        accepted: z.boolean(),
        // Pode virar prateleira de interesse. As vagas ou subjetivas ficam na ficha, no filtro e
        // na pontuação, mas uma prateleira com elas não diria nada ao jogador.
        shelf: z.boolean(),
        // No lugar do nome em "Porque você curte <título>", quando o nome não se lê bem ali
        // (Difícil → "jogos difíceis").
        title: z.string().min(1).optional(),
        // O gênero ou tema da IGDB com a mesma ideia: as prateleiras não repetem uma ideia pelas
        // duas fontes (gênero Visual Novel e etiqueta Romance Visual).
        sameIdeaAs: z
          .string()
          .regex(/^(genre|theme):[a-z0-9-]+$/)
          .optional(),
        // Os nomes de antes (os da Steam, trocados no B-79 pelo termo da comunidade), pelos quais
        // a busca do filtro do catálogo também encontra a etiqueta.
        aliases: z.array(z.string().min(1)).default([]),
        catalogGames: z.number().int().nonnegative(),
        styles: z.array(z.string().min(1)).default([]),
        keywords: z.array(z.string().min(1)).default([]),
        summaryTerms: z.array(z.string().min(1)).default([]),
      }),
    ),
  })
  .refine(({ tags }) => new Set(tags.map((t) => t.id)).size === tags.length, {
    error: 'Cada etiqueta aparece uma vez.',
  })
  .refine(
    ({ tags }) => {
      const keywords = tags.flatMap((t) => t.keywords.map((k) => k.toLowerCase()));
      return new Set(keywords).size === keywords.length;
    },
    { error: 'Uma palavra-chave é evidência de uma etiqueta só.' },
  )
  .refine(
    ({ tags }) => {
      const slugs = tags.filter((t) => t.accepted).map(tagSlug);
      return new Set(slugs).size === slugs.length;
    },
    { error: 'Cada etiqueta aceita precisa de um slug próprio.' },
  );

export type TagVocabulary = z.infer<typeof tagVocabularySchema>;
export type VocabularyTag = TagVocabulary['tags'][number];

export const TAG_VOCABULARY_FILE = resolve(process.cwd(), 'config/tags.json');

export function readTagVocabulary(file = TAG_VOCABULARY_FILE): TagVocabulary {
  return tagVocabularySchema.parse(JSON.parse(readFileSync(file, 'utf8')));
}

// Pelo nome em inglês, como os slugs dos gêneros da IGDB: ?tag=action-roguelike.
export function tagSlug({ englishName }: { englishName: string }) {
  return slugify(englishName);
}

// Os nomes de antes das etiquetas aceitas, pelo slug.
export function tagAliases(vocabulary: TagVocabulary): ReadonlyMap<string, readonly string[]> {
  return new Map(
    vocabulary.tags
      .filter((t) => t.accepted && t.aliases.length > 0)
      .map((t) => [tagSlug(t), t.aliases]),
  );
}

// As etiquetas que a partida a frio oferece: as que podem virar prateleira, pelo slug, com o gênero
// ou tema de mesma ideia ("genre:visual-novel"), ou null.
export function preferenceTags(vocabulary: TagVocabulary): ReadonlyMap<string, string | null> {
  return new Map(
    vocabulary.tags
      .filter((t) => t.accepted && t.shelf)
      .map((t) => [tagSlug(t), t.sameIdeaAs ?? null]),
  );
}

export interface RelevantTag extends SteamTag {
  // O peso dividido pelo da etiqueta mais votada do próprio jogo.
  relative: number;
}

// O peso mínimo é relativo ao do próprio jogo: um jogo popular tem milhares de votos e um pequeno
// tem dezenas, e o corte por votos absolutos tiraria as etiquetas dos pequenos.
export function relevantTags(tags: readonly SteamTag[], minRelativeWeight: number): RelevantTag[] {
  const top = Math.max(0, ...tags.map((t) => t.weight));
  if (top <= 0) return [];
  return tags
    .map((tag) => ({ ...tag, relative: tag.weight / top }))
    .filter((tag) => tag.relative >= minRelativeWeight)
    .sort((a, b) => b.weight - a.weight || a.tagid - b.tagid);
}

export interface FallbackMatch {
  tagid: number;
  source: 'keyword' | 'summary';
  term: string;
  excerpt?: string;
}

// Para o jogo sem etiquetas na Steam: as palavras-chave (pelo slug) e os termos do resumo (como
// palavra inteira) das etiquetas aceitas. Uma etiqueta pode casar pelas duas fontes, com uma
// evidência de cada, para a concordância de cada uma ser medida à parte.
export function fallbackMatcher(vocabulary: TagVocabulary) {
  const accepted = vocabulary.tags.filter((t) => t.accepted);
  const byKeyword = new Map(
    accepted.flatMap((t) => t.keywords.map((k) => [k.toLowerCase(), t.id] as const)),
  );
  const terms = accepted.flatMap((t) =>
    t.summaryTerms.map((term) => ({ tagid: t.id, term, pattern: wholeTerm(term) })),
  );

  return ({ keywords, summary }: { keywords: readonly string[]; summary: string }) => {
    const byKeywordTag = new Map<number, FallbackMatch>();
    for (const keyword of keywords) {
      const tagid = byKeyword.get(keyword.toLowerCase());
      if (tagid !== undefined && !byKeywordTag.has(tagid)) {
        byKeywordTag.set(tagid, { tagid, source: 'keyword', term: keyword });
      }
    }
    const bySummaryTag = new Map<number, FallbackMatch>();
    for (const { tagid, term, pattern } of terms) {
      if (bySummaryTag.has(tagid)) continue;
      const match = pattern.exec(summary);
      if (match) {
        const excerpt = snippet(summary, match.index, match[0].length);
        bySummaryTag.set(tagid, { tagid, source: 'summary', term, excerpt });
      }
    }
    return [...byKeywordTag.values(), ...bySummaryTag.values()];
  };
}

export interface EvidenceAgreement {
  term: string;
  tagid: number;
  // Jogos com a evidência e com etiquetas na Steam; desses, os que têm a etiqueta.
  games: number;
  confirmed: number;
}

// Nos jogos que têm as duas fontes, quantas vezes a Steam confirma a etiqueta que a palavra-chave
// ou o termo do resumo daria. A concordância baixa aponta falso positivo da reserva.
export function evidenceAgreement(
  games: readonly { matches: readonly FallbackMatch[]; steamTags: ReadonlySet<number> }[],
): EvidenceAgreement[] {
  const byTerm = new Map<string, EvidenceAgreement>();
  for (const { matches, steamTags } of games) {
    for (const { tagid, term, source } of matches) {
      const key = `${source}:${term}`;
      const entry = byTerm.get(key) ?? { term: key, tagid, games: 0, confirmed: 0 };
      entry.games++;
      if (steamTags.has(tagid)) entry.confirmed++;
      byTerm.set(key, entry);
    }
  }
  return [...byTerm.values()].sort(
    (a, b) => a.confirmed / a.games - b.confirmed / b.games || b.games - a.games,
  );
}

export interface GameTag {
  tagid: number;
  // A posição entre as aceitas da Steam, 1 para a mais votada; nula nas da reserva.
  rank: number | null;
}

export interface AssignedTags {
  steamAppId: number | null;
  source: TagSource | null;
  tags: GameTag[];
}

export interface TagEvidence {
  // Os ids da Steam do jogo na IGDB.
  appids: readonly number[];
  // Slugs das palavras-chave da IGDB.
  keywords: readonly string[];
  summary: string;
}

// Com mais de um id da Steam (edições, relançamentos), vale o primeiro que tem etiquetas, na ordem
// numérica: o id mais antigo costuma ser o do jogo original (B-77). Sem nenhuma etiqueta aceita da
// Steam no peso mínimo, entra a reserva da IGDB.
export function tagAssigner(vocabulary: TagVocabulary) {
  const accepted = new Set(vocabulary.tags.filter((t) => t.accepted).map((t) => t.id));
  const fallback = fallbackMatcher(vocabulary);

  return (game: TagEvidence, steamTags: ReadonlyMap<number, readonly SteamTag[]>): AssignedTags => {
    const appids = [...new Set(game.appids)].sort((a, b) => a - b);
    const steamAppId = appids.find((id) => steamTags.get(id)?.length) ?? appids[0] ?? null;
    const steam = relevantTags(
      steamAppId === null ? [] : (steamTags.get(steamAppId) ?? []),
      vocabulary.minRelativeWeight,
    ).filter((tag) => accepted.has(tag.tagid));
    if (steam.length > 0) {
      return {
        steamAppId,
        source: TagSource.STEAM,
        tags: steam.map(({ tagid }, i) => ({ tagid, rank: i + 1 })),
      };
    }
    const tagids = [...new Set(fallback(game).map((match) => match.tagid))].sort((a, b) => a - b);
    return {
      steamAppId,
      source: tagids.length > 0 ? TagSource.IGDB : null,
      tags: tagids.map((tagid) => ({ tagid, rank: null })),
    };
  };
}

// As etiquetas como atributos do jogo, com o nome em português do vocabulário. A etiqueta que saiu
// das aceitas fica de fora.
export function tagFeatures(vocabulary: TagVocabulary) {
  const byId = new Map(vocabulary.tags.filter((t) => t.accepted).map((t) => [t.id, t]));
  return (tags: readonly GameTag[]): MappedFeature[] =>
    tags.flatMap(({ tagid, rank }) => {
      const tag = byId.get(tagid);
      return tag
        ? [{ type: FeatureType.TAG, igdbId: tag.id, name: tag.name, slug: tagSlug(tag), rank }]
        : [];
    });
}
