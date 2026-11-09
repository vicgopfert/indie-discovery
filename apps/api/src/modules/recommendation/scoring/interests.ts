import { FeatureType } from '../../../generated/prisma/client';
import { type ContentIndex, isLabeledFeatureType } from '../content-index';
import type { Profile } from './profile';
import type { ScoringConfig } from './scoring-config';

export interface Interest {
  // A posição do atributo no índice.
  position: number;
  // O peso dos jogos da biblioteca que sustentam a prateleira; na preferência sem nenhum, β.
  coverage: number;
  // A cota dele na lista principal: coverage dividido pelo total.
  share: number;
  // Os jogos da biblioteca que sustentam a prateleira.
  supportGameIds: readonly string[];
}

interface LibraryItem {
  gameId: string;
  weight: number;
  positions: ReadonlySet<number>;
}

interface Chosen {
  position: number;
  // Índices em items.
  support: readonly number[];
  preference: boolean;
}

interface Best {
  position: number;
  support: number[];
  gain: number;
  total: number;
}

// Regra de duas fases do B-77 (docs/etiquetas.md, seção 6), até maxInterests prateleiras:
// 1. Que gostos o jogador tem: as etiquetas de gênero ou subgênero, a cada passo a que cobre mais
//    peso da biblioteca ainda sem prateleira. Depois, o gênero ou tema largo da IGDB, só para os
//    jogos que nenhuma delas cobriu.
// 2. As preferências da partida a frio, isentas do suporte e dos limites.
// 3. Completar as vagas com etiquetas de qualquer grupo, pelo peso da biblioteca que sustentam.
// Todas precisam de u_k > 0, para que notas negativas possam anular um atributo, e nenhuma ideia
// se repete (gênero Visual Novel e etiqueta Romance Visual).
export function pickInterests(
  profile: Profile,
  preferencePositions: readonly number[],
  { features, catalogJaccard }: Pick<ContentIndex, 'features' | 'catalogJaccard'>,
  hiddenPositions: ReadonlySet<number>,
  config: ScoringConfig,
): Interest[] {
  const lists = config.lists;
  const items: LibraryItem[] = profile.games
    .filter(({ weight }) => weight > 0)
    .map(({ gameId, weight, vector }) => ({
      gameId,
      weight,
      positions: new Set(vector.featurePositions),
    }));
  const libraryPositions = [...new Set(items.flatMap(({ positions }) => [...positions]))].filter(
    (position) => profile.vector[position]! > 0 && !hiddenPositions.has(position),
  );
  const ratio = (position: number) => features[position]!.documentRatio;
  const isShelfTag = (position: number) => {
    const { type, shelf, documentRatio } = features[position]!;
    return type === FeatureType.TAG && shelf && documentRatio <= lists.specificMaxDocumentRatio;
  };
  const isBroad = (position: number) => {
    const { type, documentRatio } = features[position]!;
    return isLabeledFeatureType(type) && documentRatio <= lists.interestMaxDocumentRatio;
  };

  const picked: Chosen[] = [];
  const full = () => picked.length >= lists.maxInterests;
  const weightOf = (support: readonly number[]) =>
    support.reduce((sum, i) => sum + items[i]!.weight, 0);
  const supportOf = (position: number, among: readonly number[] = items.map((_, i) => i)) =>
    among.filter((i) => items[i]!.positions.has(position));
  const covered = () => new Set(picked.flatMap(({ support }) => support));
  const repeatsIdea = (position: number) =>
    picked.some((p) => features[p.position]!.idea === features[position]!.idea);

  // O mais coberto ganha; no empate, o de maior peso na biblioteca, o menos frequente no catálogo
  // e, por fim, a posição.
  const isBetter = (candidate: Omit<Best, 'support'>, best: Best | null) =>
    best === null ||
    candidate.gain > best.gain ||
    (candidate.gain === best.gain &&
      (candidate.total > best.total ||
        (candidate.total === best.total &&
          (ratio(candidate.position) < ratio(best.position) ||
            (ratio(candidate.position) === ratio(best.position) &&
              candidate.position < best.position)))));

  // Fase 1: a que cobre mais peso ainda sem prateleira, entre os jogos de `among`, sem repetir a
  // ideia nem os jogos da biblioteca de uma prateleira já escolhida.
  const bestByGain = (positions: readonly number[], among?: readonly number[]) => {
    const alreadyCovered = covered();
    let best: Best | null = null;
    for (const position of positions) {
      const support = supportOf(position, among);
      if (support.length < lists.minSupport || !allowedInPhaseOne(position, support)) continue;
      const gain = weightOf(support.filter((i) => !alreadyCovered.has(i)));
      const candidate = { position, gain, total: weightOf(support) };
      if (gain > 0 && isBetter(candidate, best)) best = { ...candidate, support };
    }
    return best;
  };
  const allowedInPhaseOne = (position: number, support: readonly number[]) =>
    !repeatsIdea(position) &&
    !picked.some(
      (p) => !p.preference && libraryJaccard(p.support, support) > lists.libraryOverlapMax,
    );

  const gameKinds = libraryPositions.filter(
    (position) => isShelfTag(position) && features[position]!.gameKind,
  );
  while (!full()) {
    const best = bestByGain(gameKinds);
    if (best === null) break;
    picked.push({ position: best.position, support: best.support, preference: false });
  }
  const broad = libraryPositions.filter(isBroad);
  while (!full()) {
    const alreadyCovered = covered();
    const rest = items.map((_, i) => i).filter((i) => !alreadyCovered.has(i));
    const best = bestByGain(broad, rest);
    if (best === null) break;
    picked.push({ position: best.position, support: best.support, preference: false });
  }

  const preferences = [...new Set(preferencePositions)]
    .filter((position) => profile.vector[position]! > 0 && !hiddenPositions.has(position))
    .sort((a, b) => ratio(a) - ratio(b) || a - b);
  for (const position of preferences) {
    if (full()) break;
    if (!repeatsIdea(position)) {
      picked.push({ position, support: supportOf(position), preference: true });
    }
  }

  const completions = libraryPositions
    .filter(isShelfTag)
    .map((position) => ({ position, support: supportOf(position) }))
    .filter(({ support }) => support.length >= lists.minSupport)
    .map((candidate) => ({ ...candidate, weight: weightOf(candidate.support) }))
    .sort(
      (a, b) =>
        b.weight - a.weight || ratio(a.position) - ratio(b.position) || a.position - b.position,
    );
  for (const { position, support } of completions) {
    if (full()) break;
    if (repeatsIdea(position)) continue;
    if (picked.some((p) => catalogJaccard(p.position, position) > lists.catalogOverlapMax)) {
      continue;
    }
    picked.push({ position, support, preference: false });
  }

  const coverageOf = ({ support }: Chosen) => weightOf(support) || config.preferenceWeight;
  const total = picked.reduce((sum, pick) => sum + coverageOf(pick), 0);
  return picked.map((pick) => ({
    position: pick.position,
    coverage: coverageOf(pick),
    share: coverageOf(pick) / total,
    supportGameIds: pick.support.map((i) => items[i]!.gameId),
  }));
}

function libraryJaccard(a: readonly number[], b: readonly number[]): number {
  const inA = new Set(a);
  const both = b.filter((i) => inA.has(i)).length;
  const union = a.length + b.length - both;
  return union === 0 ? 0 : both / union;
}
