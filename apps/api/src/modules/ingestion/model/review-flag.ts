import type { ReviewFlagKind } from '../../../generated/prisma/client';

export interface ReviewFlag {
  kind: ReviewFlagKind;
  igdbId: number;
  gameName: string;
  detail: Record<string, unknown>;
}
