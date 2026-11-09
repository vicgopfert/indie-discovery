import type { TieBreak } from './tie-break';

// Os `limit` maiores pelo valor, com os empatados ordenados pelo desempate. Só ordena quem alcança
// o valor do corte: ordenar todos os candidatos calcularia o hash de empates bem abaixo dele. O
// corte vem de uma seleção, sem ordenar todos os valores (B-76).
export function topBy<T>(
  items: readonly T[],
  value: (item: T) => number,
  id: (item: T) => string,
  limit: number,
  tieBreak: TieBreak,
): T[] {
  const values = Float64Array.from(items, value);
  return topIndices(values, (i) => id(items[i]!), limit, tieBreak).map((i) => items[i]!);
}

// O mesmo corte sobre os valores já calculados, pela posição de cada um: as prateleiras por jogo
// montam os valores numa passada e não precisam de uma função por item (B-79).
export function topIndices(
  values: Float64Array,
  id: (index: number) => string,
  limit: number,
  tieBreak: TieBreak,
): number[] {
  let pool: number[];
  if (limit > 0 && values.length > limit) {
    const cut = kthLargest(values.slice(), limit);
    pool = [];
    for (let i = 0; i < values.length; i++) if (values[i]! >= cut) pool.push(i);
  } else {
    pool = Array.from(values.keys());
  }
  return pool.sort((a, b) => values[b]! - values[a]! || tieBreak(id(a), id(b))).slice(0, limit);
}

// O k-ésimo maior valor, com k a partir de 1: o mesmo de ordenar em ordem crescente e pegar a
// posição n − k, por seleção (Hoare), em tempo linear na média. Reordena `values`.
export function kthLargest(values: Float64Array, k: number): number {
  const target = values.length - k;
  let low = 0;
  let high = values.length - 1;
  while (low < high) {
    const pivot = values[(low + high) >> 1]!;
    let i = low;
    let j = high;
    while (i <= j) {
      while (values[i]! < pivot) i++;
      while (values[j]! > pivot) j--;
      if (i <= j) {
        const swap = values[i]!;
        values[i++] = values[j]!;
        values[j--] = swap;
      }
    }
    if (target <= j) high = j;
    else if (target >= i) low = i;
    else break;
  }
  return values[target]!;
}
