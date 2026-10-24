// O "Want to Play" da IGDB é a fração da base de usuários que marcou o jogo, não uma contagem.
// Todo valor é múltiplo inteiro da fração de uma pessoa, então a contagem é reconstruída dividindo
// pela menor fração positiva da execução. A quantização não é documentada pela IGDB: se algum valor
// sair da grade, a execução falha em vez de normalizar errado.
export interface PopularityScale {
  unit: number;
  maxCount: number;
  medianCount: number;
}

const GRID_TOLERANCE = 1e-6;

export class PopularityQuantizationError extends Error {
  constructor(
    readonly offGrid: number,
    readonly total: number,
  ) {
    super(
      `${offGrid} de ${total} valores de "Want to Play" não são múltiplos inteiros da menor fração`,
    );
  }
}

// O máximo é o do catálogo aceito que a execução recebe, não o da IGDB inteira.
export function popularityScale(acceptedCatalogValues: Iterable<number>): PopularityScale | null {
  const positive = [...acceptedCatalogValues].filter((value) => value > 0);
  if (positive.length === 0) return null;

  const unit = Math.min(...positive);
  const counts = positive.map((value) => value / unit);
  const offGrid = counts.filter((count) => Math.abs(count - Math.round(count)) > GRID_TOLERANCE);
  if (offGrid.length > 0) throw new PopularityQuantizationError(offGrid.length, positive.length);

  const sorted = counts.map(Math.round).sort((a, b) => a - b);
  return { unit, maxCount: sorted.at(-1)!, medianCount: median(sorted) };
}

// A contagem é o valor gravado no jogo: a unidade muda todo dia, a contagem de um jogo não.
export function reconstructedCount(value: number, scale: PopularityScale | null) {
  if (scale === null || value <= 0) return 0;
  return Math.round(value / scale.unit);
}

// pop_j = log(1 + p/u) / log(1 + p_max/u), entre 0 e 1.
export function normalizedPopularity(count: number, scale: PopularityScale | null) {
  if (scale === null || count <= 0) return 0;
  return Math.log1p(count) / Math.log1p(scale.maxCount);
}

function median(sorted: number[]) {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
