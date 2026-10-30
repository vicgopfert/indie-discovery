import type { GameSummary } from '@indie/contracts';

export function UpcomingBadge({ releaseStatus }: Pick<GameSummary, 'releaseStatus'>) {
  if (releaseStatus !== 'UPCOMING') return null;
  return (
    <span className="inline-block rounded-md border px-2 py-0.5 text-xs font-medium">Em breve</span>
  );
}
