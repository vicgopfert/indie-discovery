import type { GameSummary } from '@indie/contracts';

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' });

const formatDate = (isoDate: string) => dateFormat.format(new Date(`${isoDate}T00:00:00Z`));

export function releaseLabel({ releaseStatus, firstReleaseDate }: GameSummary) {
  if (releaseStatus === 'UPCOMING') {
    return firstReleaseDate ? `Previsto para ${formatDate(firstReleaseDate)}` : 'Sem data prevista';
  }
  return firstReleaseDate ? `Lançado em ${formatDate(firstReleaseDate)}` : 'Data não informada';
}
