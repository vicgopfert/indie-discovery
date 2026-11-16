import {
  featurePosition,
  gameId,
  scoringIndex,
} from '../modules/recommendation/scoring/scoring.fixture';
import { popularBaseline, randomBaseline } from './baselines';

describe('linhas de base', () => {
  const index = scoringIndex();

  it('aleatória: só jogos com vetor e fora da biblioteca, a mesma com a mesma semente', () => {
    const excluded = new Set([gameId('hades'), gameId('celeste')]);
    const picked = randomBaseline(index, excluded, 10, 7);

    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    expect(picked.every((game) => game.weights.length > 0 && !excluded.has(game.id))).toBe(true);
    expect(randomBaseline(index, excluded, 10, 7)).toEqual(picked);
    expect(randomBaseline(index, excluded, 10, 8)).not.toEqual(picked);
  });

  it('aleatória: devolve todos os disponíveis quando há menos que o pedido', () => {
    const available = index.games.filter((game) => game.weights.length > 0).length;

    expect(randomBaseline(index, new Set(), available + 5, 1)).toHaveLength(available);
  });

  it('populares: os mais populares dos gêneros e temas dos jogos com nota 4 ou mais', () => {
    const hidden = new Set<number>();
    const picked = popularBaseline(
      index,
      hidden,
      {
        ratings: [
          { gameId: gameId('celeste'), score: 5 },
          { gameId: gameId('inside'), score: 2 },
        ],
        preferencePositions: [],
      },
      new Set([gameId('celeste'), gameId('inside')]),
      3,
      'usuario',
    );

    // Celeste tem o gênero Platform; as etiquetas dele não contam. Inside (nota 2) não conta.
    expect(picked.map(({ slug }) => slug)).toEqual(['limbo', 'spelunky', 'dead-cells']);
  });

  it('populares: as preferências entram, e o gênero escondido não', () => {
    const roguelike = featurePosition(index, 'roguelike');
    const picked = popularBaseline(
      index,
      new Set([featurePosition(index, 'platform')]),
      {
        ratings: [{ gameId: gameId('celeste'), score: 5 }],
        preferencePositions: [roguelike],
      },
      new Set([gameId('celeste')]),
      2,
      'usuario',
    );

    expect(picked.map(({ slug }) => slug)).toEqual(['popular-rogue', 'hades']);
  });
});
