const PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e']);

const graphemes = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

const firstGrapheme = (word: string) =>
  graphemes.segment(word)[Symbol.iterator]().next().value!.segment;

// "Maria da Silva" vira "MS": as partículas só contam quando o nome é feito só delas.
export function initials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  const named = words.filter((word) => !PARTICLES.has(word.toLocaleLowerCase('pt-BR')));
  const [first, ...rest] = named.length > 0 ? named : words;
  const last = rest.at(-1);
  return [first, last]
    .filter((word) => word !== undefined)
    .map((word) => firstGrapheme(word).toLocaleUpperCase('pt-BR'))
    .join('');
}
