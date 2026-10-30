import {
  type CountryOption,
  COUNTRY_UNKNOWN,
  type FeatureOption,
  GAMES_FILTER_MAX_VALUES,
  GAMES_SEARCH_MAX_LENGTH,
  type GameSearchQuery,
} from '@indie/contracts';
import Form from 'next/form';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CATALOG_PATH, catalogHref } from './search-params';

export interface CatalogFilterOptions {
  genres: FeatureOption[];
  themes: FeatureOption[];
  countries: CountryOption[];
}

type Choice = { value: string; label: string };

const STATUS_CHOICES: Choice[] = [
  { value: '', label: 'Todas' },
  { value: 'released', label: 'Lançados' },
  { value: 'upcoming', label: 'Em breve' },
];

const PORTUGUESE_CHOICES: Choice[] = [
  { value: '', label: 'Qualquer' },
  { value: 'yes', label: 'Com português' },
  { value: 'no', label: 'Sem português' },
  { value: 'unknown', label: 'Não informado' },
];

const SORT_CHOICES: Choice[] = [
  { value: 'popular', label: 'Mais populares' },
  { value: 'newest', label: 'Mais recentes' },
  { value: 'name', label: 'Nome' },
];

const withCount = ({ name, gameCount }: { name: string; gameCount: number }) =>
  `${name} (${gameCount.toLocaleString('pt-BR')})`;

// Enviar o formulário volta para a página 1, porque ele não leva o campo "page".
export function CatalogFilters({
  query,
  options,
}: {
  query: GameSearchQuery;
  options: CatalogFilterOptions;
}) {
  return (
    // Os campos não são controlados: a key os recria quando a URL muda (por exemplo, ao limpar).
    <Form key={catalogHref(query)} action={CATALOG_PATH} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="catalog-q">Buscar pelo nome</Label>
        <Input
          id="catalog-q"
          name="q"
          type="search"
          defaultValue={query.q ?? ''}
          maxLength={GAMES_SEARCH_MAX_LENGTH}
        />
      </div>
      <ChoiceList
        legend="Gênero"
        name="genre"
        selected={query.genre}
        choices={options.genres.map((genre) => ({ value: genre.slug, label: withCount(genre) }))}
      />
      <ChoiceList
        legend="Tema"
        name="theme"
        selected={query.theme}
        choices={options.themes.map((theme) => ({ value: theme.slug, label: withCount(theme) }))}
      />
      <Select label="Situação" name="status" value={query.status} choices={STATUS_CHOICES} />
      <Select
        label="Português"
        name="portuguese"
        value={query.portuguese}
        choices={PORTUGUESE_CHOICES}
      />
      <ChoiceList
        legend="País do estúdio"
        name="country"
        selected={query.country}
        choices={[
          ...options.countries.map((country) => ({
            value: country.code,
            label: withCount(country),
          })),
          { value: COUNTRY_UNKNOWN, label: 'Não informado' },
        ]}
      />
      <Select label="Ordenar por" name="sort" value={query.sort} choices={SORT_CHOICES} />
      <div className="flex items-center gap-4">
        <Button type="submit">Filtrar</Button>
        <Link href={CATALOG_PATH} className="text-sm underline">
          Limpar filtros
        </Link>
      </div>
    </Form>
  );
}

function ChoiceList({
  legend,
  name,
  choices,
  selected,
}: {
  legend: string;
  name: string;
  choices: Choice[];
  selected: string[];
}) {
  return (
    <details open={selected.length > 0} className="rounded-md border px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">
        {legend}
        {selected.length > 0 && ` (${selected.length})`}
      </summary>
      <fieldset className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        <legend className="mb-1 text-xs text-muted-foreground">
          {legend}: escolha até {GAMES_FILTER_MAX_VALUES}
        </legend>
        {choices.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={value}
              defaultChecked={selected.includes(value)}
            />
            {label}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

function Select({
  label,
  name,
  value,
  choices,
}: {
  label: string;
  name: string;
  value: string | undefined;
  choices: Choice[];
}) {
  const id = `catalog-${name}`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={value ?? ''}
        className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
      >
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    </div>
  );
}
