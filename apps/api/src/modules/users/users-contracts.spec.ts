import { UpdateMeSchema } from '@indie/contracts';
import { DiscoveryMode } from '../../generated/prisma/client';

describe('UpdateMeSchema', () => {
  it('aceita os três modos do banco', () => {
    for (const discoveryMode of Object.values(DiscoveryMode)) {
      expect(UpdateMeSchema.parse({ discoveryMode })).toEqual({ discoveryMode });
    }
  });

  it('recusa modo ausente, em minúsculas ou desconhecido', () => {
    for (const body of [{}, { discoveryMode: 'balanced' }, { discoveryMode: 'RANDOM' }]) {
      expect(UpdateMeSchema.safeParse(body).error?.issues[0]?.message).toBe(
        'Modo deve ser POPULAR, BALANCED ou DISCOVERY.',
      );
    }
  });
});
