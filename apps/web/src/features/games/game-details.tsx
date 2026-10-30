import type { FeatureLabel, GameDetail } from '@indie/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { CATALOG_PATH } from '@/features/catalog/search-params';
import { GameCover } from './game-cover';
import {
  companyNames,
  countrySource,
  languageSupport,
  NOT_INFORMED,
  portugueseSupport,
} from './game-facts';
import { releaseLabel } from './release-label';
import { UpcomingBadge } from './upcoming-badge';

const external = { target: '_blank', rel: 'noopener noreferrer' } as const;

const catalogFilteredBy = (param: string, value: string) =>
  `${CATALOG_PATH}?${new URLSearchParams({ [param]: value }).toString()}`;

export function GameDetails({ game }: { game: GameDetail }) {
  return (
    <article className="flex flex-col gap-8 md:flex-row md:items-start">
      <GameCover name={game.name} coverImageId={game.coverImageId} size="big" preload />
      <div className="min-w-0 flex-1 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">{game.name}</h1>
          <UpcomingBadge releaseStatus={game.releaseStatus} />
          <p className="text-sm text-muted-foreground">{releaseLabel(game)}</p>
        </header>

        {game.officialUrl ? (
          <Button asChild>
            <a href={game.officialUrl} {...external}>
              Página oficial
            </a>
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Link oficial não informado</p>
        )}

        <section aria-labelledby="game-summary" className="space-y-2">
          <h2 id="game-summary" className="font-medium">
            Resumo
          </h2>
          <p className="whitespace-pre-line">{game.summary}</p>
        </section>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
          <Fact term="Gêneros">
            <FeatureLinks param="genre" features={game.genres} />
          </Fact>
          <Fact term="Temas">
            <FeatureLinks param="theme" features={game.themes} />
          </Fact>
          <Fact term="Desenvolvimento">{companyNames(game.developers)}</Fact>
          <Fact term="Publicação">{companyNames(game.publishers)}</Fact>
          <Fact term="País do estúdio">
            {game.studioCountry ? (
              <>
                <Link
                  href={catalogFilteredBy('country', game.studioCountry.code)}
                  className="underline"
                >
                  {game.studioCountry.name}
                </Link>{' '}
                <span className="text-sm text-muted-foreground">
                  ({countrySource(game.studioCountry)})
                </span>
              </>
            ) : (
              NOT_INFORMED
            )}
          </Fact>
          <Fact term="Português">
            {portugueseSupport(game.languages).map((line) => (
              <p key={line}>{line}</p>
            ))}
          </Fact>
        </dl>

        {game.languages.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              Todos os idiomas ({game.languages.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm">
              {game.languages.map((language) => (
                <li key={language.locale}>{languageSupport(language)}</li>
              ))}
            </ul>
          </details>
        )}

        <p className="text-sm text-muted-foreground">
          Dados do{' '}
          <a href={`https://www.igdb.com/games/${game.slug}`} {...external} className="underline">
            IGDB
          </a>
          .
        </p>
      </div>
    </article>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="font-medium">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

function FeatureLinks({ param, features }: { param: string; features: FeatureLabel[] }) {
  if (features.length === 0) return NOT_INFORMED;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {features.map(({ slug, name }) => (
        <li key={slug}>
          <Link href={catalogFilteredBy(param, slug)} className="underline">
            {name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
