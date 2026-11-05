import { createHash } from 'node:crypto';

export type TieBreak = (a: string, b: string) => number;

// Sorteio fixo por usuário: o hash de userId + gameId ordena os empatados, e o id resolve o que
// sobrar. O mesmo estado gera a mesma lista, mas usuários com o mesmo gosto veem empatados
// diferentes. A popularidade fica fora do desempate: ela já entra pelo λ do modo (B-12).
export function userTieBreak(userId: string): TieBreak {
  const keys = new Map<string, string>();
  const keyOf = (gameId: string) => {
    let key = keys.get(gameId);
    if (key === undefined) {
      key = createHash('sha256').update(`${userId}:${gameId}`).digest('hex');
      keys.set(gameId, key);
    }
    return key;
  };
  return (a, b) => compareStrings(keyOf(a), keyOf(b)) || compareStrings(a, b);
}

function compareStrings(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
