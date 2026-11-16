import { createHash } from 'node:crypto';

// Gerador com semente (mulberry32): a mesma semente dá a mesma sequência em toda execução.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Uma semente para cada combinação de partes: os sorteios de uma execução não dependem da ordem
// em que as outras foram feitas.
export function seedOf(...parts: readonly (string | number)[]): number {
  return createHash('sha256').update(parts.join('|')).digest().readUInt32BE(0);
}

// `count` itens distintos, todos com a mesma chance.
export function sample<T>(random: () => number, items: readonly T[], count: number): T[] {
  if (items.length < count) throw new Error(`Não há ${count} itens para sortear.`);
  const picked = new Set<T>();
  while (picked.size < count) picked.add(items[Math.floor(random() * items.length)]!);
  return [...picked];
}

// `count` itens distintos, cada um com chance proporcional ao peso, sem reposição. Peso zero não
// é sorteado.
export function weightedSample<T>(
  random: () => number,
  items: readonly T[],
  weightOf: (item: T) => number,
  count: number,
): T[] {
  const pool = items.map((item) => ({ item, weight: weightOf(item) }));
  const eligible = pool.filter(({ weight }) => weight > 0);
  if (eligible.length < count) {
    throw new Error(`Não há ${count} itens com peso positivo para sortear.`);
  }
  let total = eligible.reduce((sum, { weight }) => sum + weight, 0);
  const picked: T[] = [];
  while (picked.length < count) {
    let target = random() * total;
    let i = 0;
    while (i < eligible.length - 1 && target >= eligible[i]!.weight) {
      target -= eligible[i]!.weight;
      i++;
    }
    const [chosen] = eligible.splice(i, 1);
    picked.push(chosen!.item);
    total -= chosen!.weight;
  }
  return picked;
}
