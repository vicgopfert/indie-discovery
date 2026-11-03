import { FeatureType, ReleaseStatus } from '../../generated/prisma/client';
import { buildContentIndex, type ContentIndexRows } from './content-index';
import { ContentIndexService } from './content-index.service';
import type { ContentIndexRepository } from './content-index.repository';
import {
  computeIdf,
  type ContentFeature,
  featureKey,
  readTfidfConfig,
  type TfidfConfig,
  tfidfVector,
} from './tfidf';

const config: TfidfConfig = { ...readTfidfConfig(), minDocumentFrequency: 2 };

const feature = (type: FeatureType, igdbId: number): ContentFeature => ({
  type,
  igdbId,
  name: `${type}-${igdbId}`,
});

// O gênero 9 só aparece em um jogo e fica abaixo do mínimo: IDF zero, fora do índice.
const catalog: Record<string, ContentFeature[]> = {
  celeste: [feature('GENRE', 1), feature('GENRE', 2), feature('THEME', 1), feature('KEYWORD', 1)],
  hades: [feature('GENRE', 1), feature('THEME', 1), feature('KEYWORD', 1)],
  tunic: [feature('GENRE', 2), feature('THEME', 2), feature('GENRE', 9)],
  outer: [feature('GENRE', 1), feature('THEME', 2)],
  vazio: [],
};

function rowsFor(games: Record<string, ContentFeature[]>): ContentIndexRows {
  const idf = computeIdf(Object.values(games), config);
  const features = [
    ...new Map(
      Object.values(games)
        .flat()
        .map((f) => [featureKey(f), f]),
    ).values(),
  ]
    .filter((f) => (idf.get(featureKey(f)) ?? 0) > 0)
    .map((f) => ({ ...f, id: `f-${featureKey(f)}`, slug: f.name, idf: idf.get(featureKey(f))! }));
  const position = new Map(features.map((f, i) => [featureKey(f), i]));
  return {
    features,
    games: Object.entries(games).map(([slug, list], i) => ({
      id: `g-${slug}`,
      slug,
      releaseStatus: ReleaseStatus.RELEASED,
      popularityNorm: i / 10,
      featurePositions: list
        .map((f) => position.get(featureKey(f)))
        .filter((p): p is number => p !== undefined),
    })),
  };
}

describe('buildContentIndex', () => {
  const rows = rowsFor(catalog);
  const index = buildContentIndex(rows, config);

  it('refaz para cada jogo o mesmo vetor que a ingestão calcula', () => {
    const idf = computeIdf(Object.values(catalog), config);
    for (const game of index.games) {
      const expected = tfidfVector(catalog[game.slug]!, idf, config).weights;
      const rebuilt = new Map(
        [...game.featurePositions].map((position, i) => {
          const { type, name } = index.features[position]!;
          const igdbId = Number(name.split('-')[1]);
          return [featureKey({ type, igdbId }), game.weights[i]!];
        }),
      );
      expect(rebuilt.size).toBe(expected.size);
      for (const [key, weight] of expected) expect(rebuilt.get(key)).toBeCloseTo(weight, 12);
    }
  });

  it('guarda as posições em ordem crescente e o vetor com norma 1', () => {
    for (const game of index.games.filter((g) => g.weights.length > 0)) {
      expect([...game.featurePositions]).toEqual([...game.featurePositions].sort((a, b) => a - b));
      expect(game.weights.reduce((sum, w) => sum + w * w, 0)).toBeCloseTo(1, 12);
    }
  });

  it('deixa de fora o atributo com IDF zero e mantém o jogo sem atributos com vetor vazio', () => {
    expect(index.features.map((f) => f.name)).not.toContain('GENRE-9');
    const vazio = index.games[index.positionByGameId.get('g-vazio')!]!;
    expect(vazio.weights).toHaveLength(0);
    expect(index.games).toHaveLength(5);
  });

  it('monta o vetor de um jogo fora do índice igual ao que ele teria no índice', () => {
    const withoutCeleste = buildContentIndex(
      { ...rows, games: rows.games.filter((game) => game.slug !== 'celeste') },
      config,
    );
    const celeste = index.games[index.positionByGameId.get('g-celeste')!]!;

    expect(withoutCeleste.positionByGameId.has('g-celeste')).toBe(false);
    expect(withoutCeleste.vectorOf(catalog.celeste!)).toEqual({
      featurePositions: celeste.featurePositions,
      weights: celeste.weights,
    });
  });

  it('ignora no vetor de fora o atributo que não está no índice', () => {
    const tunic = index.games[index.positionByGameId.get('g-tunic')!]!;

    expect(index.vectorOf(catalog.tunic!)).toEqual({
      featurePositions: tunic.featurePositions,
      weights: tunic.weights,
    });
    expect(index.vectorOf([feature('GENRE', 9)]).weights).toHaveLength(0);
  });

  it('acha a posição de cada atributo pelo id gravado no banco', () => {
    for (const [position, { id }] of index.features.entries()) {
      expect(index.positionByFeatureId.get(id)).toBe(position);
    }
  });

  it('traz os dados que a recomendação usa para filtrar e ordenar', () => {
    expect(index.games[index.positionByGameId.get('g-tunic')!]).toMatchObject({
      slug: 'tunic',
      releaseStatus: 'RELEASED',
      popularityNorm: 0.2,
    });
  });
});

describe('ContentIndexService', () => {
  const rows = rowsFor(catalog);

  function serviceWith(loadRows: () => Promise<ContentIndexRows>) {
    const repository = { loadRows: jest.fn(loadRows) };
    const service = new ContentIndexService(
      repository as unknown as ContentIndexRepository,
      config,
    );
    return { service, repository };
  }

  it('começa carregando e fica pronto depois da carga', async () => {
    const { service } = serviceWith(() => Promise.resolve(rows));
    expect(service.status()).toEqual({ status: 'loading' });

    await service.reload();

    expect(service.status()).toMatchObject({ status: 'ready', games: 5 });
    expect(service.index?.games).toHaveLength(5);
  });

  it('recargas simultâneas compartilham a mesma leitura do banco', async () => {
    const { service, repository } = serviceWith(() => Promise.resolve(rows));

    await Promise.all([service.reload(), service.reload(), service.reload()]);

    expect(repository.loadRows).toHaveBeenCalledTimes(1);
  });

  it('sem índice anterior, a falha deixa o status em failed', async () => {
    const { service } = serviceWith(() => Promise.reject(new Error('banco fora do ar')));

    await expect(service.reload()).rejects.toThrow('banco fora do ar');

    expect(service.status()).toEqual({ status: 'failed' });
    expect(service.index).toBeNull();
  });

  it('settled espera a carga em andamento sem disparar outra nem propagar a falha', async () => {
    const { service, repository } = serviceWith(() =>
      Promise.reject(new Error('banco fora do ar')),
    );
    service.reload().catch(() => undefined);

    await expect(service.settled()).resolves.toBeUndefined();
    await expect(service.settled()).resolves.toBeUndefined();

    expect(repository.loadRows).toHaveBeenCalledTimes(1);
    expect(service.status()).toEqual({ status: 'failed' });
  });

  it('uma recarga que falha mantém o índice anterior', async () => {
    let fail = false;
    const { service } = serviceWith(() =>
      fail ? Promise.reject(new Error('banco fora do ar')) : Promise.resolve(rows),
    );
    await service.reload();
    const previous = service.index;
    fail = true;

    await expect(service.reload()).rejects.toThrow();

    expect(service.index).toBe(previous);
    expect(service.status()).toMatchObject({ status: 'ready' });
  });
});
