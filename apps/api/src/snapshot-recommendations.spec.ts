import {
  assertLocalDatabase,
  compareSnapshots,
  profileUserId,
  type Snapshot,
  type SnapshotEntry,
} from './snapshot-recommendations';

const entry = (page: number | null, hash: string): SnapshotEntry => ({
  profile: 0,
  mode: 'BALANCED',
  key: page === null ? null : 'main',
  page,
  status: 200,
  hash,
});

describe('foto das recomendações', () => {
  it('só roda em banco local', () => {
    expect(() => assertLocalDatabase('postgresql://u:p@localhost:5433/indie')).not.toThrow();
    expect(() => assertLocalDatabase('postgresql://u:p@127.0.0.1/indie')).not.toThrow();
    expect(() => assertLocalDatabase('postgresql://u:p@ep-x.us-east-1.aws.neon.tech/db')).toThrow(
      'banco local',
    );
  });

  it('dá o mesmo id de usuário ao mesmo perfil, em formato UUID', () => {
    expect(profileUserId(7)).toBe(profileUserId(7));
    expect(profileUserId(7)).not.toBe(profileUserId(8));
    expect(profileUserId(7)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('compara as respostas da foto nova com as da anterior', () => {
    const before: Snapshot = {
      scope: 'full',
      entries: [entry(null, 'a'), entry(1, 'b'), entry(2, 'c')],
    };

    expect(
      compareSnapshots(before, { scope: 'quick', entries: [entry(null, 'a'), entry(2, 'c')] }),
    ).toEqual({
      compared: 2,
      missing: [],
      different: [],
    });
    expect(
      compareSnapshots(before, { scope: 'quick', entries: [entry(1, 'x'), entry(3, 'd')] }),
    ).toEqual({
      compared: 1,
      missing: ['0|BALANCED|main|3'],
      different: ['0|BALANCED|main|1'],
    });
  });
});
