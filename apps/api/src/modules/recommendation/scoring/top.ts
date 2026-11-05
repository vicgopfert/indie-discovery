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
  let pool = items;
  if (limit > 0 && items.length > limit) {
    const cut = kthLargest(Float64Array.from(items, value), limit);
    pool = items.filter((item) => value(item) >= cut);
  }
  return [...pool].sort((a, b) => value(b) - value(a) || tieBreak(id(a), id(b))).slice(0, limit);
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
