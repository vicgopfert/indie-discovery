import type { IndexedGame } from '../content-index';
import type { RankedList } from './lists';
import { listPage, overview } from './overview';
import { scoringConfig } from './scoring.fixture';
import type { ListsConfig } from './scoring-config';

const games = (...ids: string[]) => ids.map((id) => ({ id }) as IndexedGame);

const list = (key: string, ids: string[], bySimilarity: string[] | null = null): RankedList => {
  const listed = games(...ids);
  const byId = new Map(listed.map((game) => [game.id, game]));
  return {
    key,
    kind: key === 'main' ? 'main' : key === 'upcoming' ? 'upcoming' : 'interest',
    attribute: null,
    games: listed,
    bySimilarity:
      bySimilarity && (bySimilarity.map((id) => byId.get(id) ?? { id }) as IndexedGame[]),
  };
};

const config = (lists: Partial<ListsConfig>): ListsConfig => ({ ...scoringConfig.lists, ...lists });

describe('overview', () => {
  const small = config({ overviewMainSize: 3, overviewShelfSize: 2, shelfMinItems: 2 });
  const shown = (result: ReturnType<typeof overview>) =>
    result.map(({ list: { key }, items, hasMore }) => [key, items.map((i) => i.game.id), hasMore]);

  it('mostra a principal primeiro e cada prateleira sem os jogos que apareceram antes', () => {
    const lists = [
      list('main', ['a', 'b', 'c', 'd']),
      list('upcoming', ['b', 'e', 'f']),
      list('genre:rpg', ['a', 'e', 'g', 'h']),
    ];

    expect(shown(overview(lists, small))).toEqual([
      ['main', ['a', 'b', 'c'], true],
      ['upcoming', ['e', 'f'], true],
      ['genre:rpg', ['g', 'h'], true],
    ]);
  });

  it('a prateleira abaixo do mínimo não aparece, e os jogos dela continuam livres', () => {
    const lists = [
      list('main', ['a', 'b', 'c']),
      list('upcoming', ['a', 'b', 'x']),
      list('theme:horror', ['x', 'y']),
    ];

    expect(shown(overview(lists, small))).toEqual([
      ['main', ['a', 'b', 'c'], false],
      ['theme:horror', ['x', 'y'], false],
    ]);
  });

  it('hasMore diz se a lista completa tem mais jogos que os mostrados', () => {
    const lists = [list('main', ['a', 'b']), list('genre:rpg', ['a', 'c', 'd'])];

    expect(shown(overview(lists, small))).toEqual([
      ['main', ['a', 'b'], false],
      ['genre:rpg', ['c', 'd'], true],
    ]);
  });

  it('mostra a principal mesmo vazia', () => {
    expect(shown(overview([list('main', [])], small))).toEqual([['main', [], false]]);
  });
});

describe('listPage', () => {
  const pages = config({ pageSize: 2 });
  const ids = ['a', 'b', 'c', 'd', 'e'];

  it('pagina a lista completa até o teto, e além dele vem vazia', () => {
    const page = (n: number) => {
      const { items, hasMore } = listPage(list('genre:rpg', ids), n, pages);
      return [items.map((i) => i.game.id), hasMore];
    };

    expect([1, 2, 3, 4].map(page)).toEqual([
      [['a', 'b'], true],
      [['c', 'd'], true],
      [['e'], false],
      [[], false],
    ]);
  });
});

describe('"pouco conhecido"', () => {
  // Pela similaridade (λ = 0), a ordem seria a, b, c, d, e.
  const discovery = list('main', ['d', 'a', 'e', 'b', 'c'], ['a', 'b', 'c', 'd', 'e']);
  const lowKnown = (items: { game: IndexedGame; lowKnown: boolean }[]) =>
    items.filter((i) => i.lowKnown).map((i) => i.game.id);

  it('marca quem não estaria entre os N primeiros da lista montada com λ = 0', () => {
    const { items } = listPage(discovery, 1, config({ pageSize: 2 }));

    expect(lowKnown(items)).toEqual(['d']);
  });

  it('N é a posição do último jogo mostrado, na lista completa', () => {
    expect(lowKnown(listPage(discovery, 2, config({ pageSize: 2 })).items)).toEqual(['e']);
    expect(lowKnown(listPage(discovery, 1, config({ pageSize: 5 })).items)).toEqual([]);
  });

  it('na visão geral, conta a posição na lista completa, com os repetidos', () => {
    const lists = [
      list('main', ['a', 'b']),
      list('genre:rpg', ['a', 'b', 'x', 'y'], ['x', 'a', 'b', 'y']),
    ];
    const [, shelf] = overview(
      lists,
      config({ overviewMainSize: 2, overviewShelfSize: 2, shelfMinItems: 1 }),
    );

    // Mostrados x e y, nas posições 3 e 4: com λ = 0 os quatro estariam entre os 4 primeiros.
    expect(lowKnown(shelf!.items)).toEqual([]);
  });

  it('fora do modo Descobertas, nunca marca', () => {
    expect(lowKnown(listPage(list('main', ['d', 'a']), 1, config({ pageSize: 2 })).items)).toEqual(
      [],
    );
  });
});
