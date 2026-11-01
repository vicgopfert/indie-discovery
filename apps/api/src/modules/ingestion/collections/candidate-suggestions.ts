import { z } from 'zod';
import {
  querySparql,
  WIKIDATA_DEFAULTS,
  type WikidataOptions,
} from '../wikidata/wikidata-country.source';
import type { CuratedCollection } from './collections.config';

export interface CandidateGame {
  igdbId: number;
  slug: string;
  name: string;
  summary: string;
  popularityCount: number;
  keywords: string[];
}

export interface Candidate {
  igdbId: number;
  name: string;
  popularityCount: number;
  evidence: string[];
}

const SNIPPET_RADIUS = 60;

// Palavra inteira, sem diferenciar maiúsculas: "Brazil" não acha "Brazilian", que é outro termo.
const wholeTerm = (term: string) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`,
    'iu',
  );

function snippet(summary: string, index: number, length: number) {
  const start = Math.max(0, index - SNIPPET_RADIUS);
  const end = Math.min(summary.length, index + length + SNIPPET_RADIUS);
  const text = summary.slice(start, end).replace(/\s+/g, ' ').trim();
  return `${start > 0 ? '…' : ''}${text}${end < summary.length ? '…' : ''}`;
}

// Só sugere: aprovar ou recusar é decisão do autor, registrada no arquivo de coleções.
export function suggestCandidates(
  collection: CuratedCollection,
  games: readonly CandidateGame[],
  narrativePlaces: ReadonlyMap<string, ReadonlySet<string>>,
): Candidate[] {
  const decided = new Set([...collection.games, ...collection.rejected].map((g) => g.igdbId));
  const keywords = new Set(collection.suggest.keywords.map((k) => k.toLowerCase()));
  const terms = collection.suggest.summaryTerms.map((term) => ({ term, pattern: wholeTerm(term) }));
  const places = new Set(collection.suggest.wikidataPlaces);

  return games
    .filter((game) => !decided.has(game.igdbId))
    .flatMap((game) => {
      const evidence = [
        ...game.keywords
          .filter((k) => keywords.has(k.toLowerCase()))
          .map((k) => `palavra-chave: ${k}`),
        ...terms.flatMap(({ term, pattern }) => {
          const match = pattern.exec(game.summary);
          return match
            ? [`resumo (${term}): ${snippet(game.summary, match.index, term.length)}`]
            : [];
        }),
        ...[...(narrativePlaces.get(game.slug) ?? [])]
          .filter((place) => places.has(place))
          .map((place) => `Wikidata, local da narrativa: ${place}`),
      ];
      return evidence.length > 0
        ? [
            {
              igdbId: game.igdbId,
              name: game.name,
              popularityCount: game.popularityCount,
              evidence,
            },
          ]
        : [];
    })
    .sort((a, b) => b.popularityCount - a.popularityCount || a.name.localeCompare(b.name));
}

// Local da narrativa (P840) dos jogos com o identificador da IGDB (P5794, o slug), com o país do
// lugar (P17): basta o lugar ou o país dele estar na regra da coleção.
const NARRATIVE_QUERY = `
SELECT ?igdb ?place ?country WHERE {
  ?game wdt:P5794 ?igdb ; wdt:P840 ?place .
  OPTIONAL { ?place wdt:P17 ?country . }
}`;

const entity = z.object({ value: z.string() });
const narrativeSchema = z.object({
  results: z.object({
    bindings: z.array(z.object({ igdb: entity, place: entity, country: entity.optional() })),
  }),
});

const qid = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);

export async function narrativePlacesBySlug(
  options: WikidataOptions = WIKIDATA_DEFAULTS,
): Promise<ReadonlyMap<string, ReadonlySet<string>>> {
  const { bindings } = narrativeSchema.parse(await querySparql(options, NARRATIVE_QUERY)).results;
  const bySlug = new Map<string, Set<string>>();
  for (const { igdb, place, country } of bindings) {
    const places = bySlug.get(igdb.value) ?? new Set<string>();
    places.add(qid(place.value));
    if (country) places.add(qid(country.value));
    bySlug.set(igdb.value, places);
  }
  return bySlug;
}
