'use client';

import {
  type FeatureOption,
  PREFERENCES_MIN,
  type PreferenceOptions,
  type Preferences,
  PreferencesInputSchema,
} from '@indie/contracts';
import Link from 'next/link';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { normalized } from '@/features/catalog/choice-list';
import { errorMessage } from '@/lib/api-client';
import { usePreferenceOptions, usePreferences, useSavePreferences } from './hooks';

type Group = keyof PreferenceOptions;
type Selection = Record<Group, string[]>;

export const TAGS_INITIAL = 24;

export function PreferencesStep({ next, onSaved }: { next: string; onSaved: () => void }) {
  const options = usePreferenceOptions();
  const current = usePreferences();

  if (options.isPending || current.isPending) {
    return <p className="text-sm text-muted-foreground">Carregando as opções…</p>;
  }
  if (options.isError || current.isError) {
    return (
      <div role="alert" className="space-y-2">
        <p>{errorMessage(options.error ?? current.error)}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void Promise.all([options.refetch(), current.refetch()])}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  return (
    <PreferencesForm options={options.data} initial={current.data} next={next} onSaved={onSaved} />
  );
}

const slugsOf = (preferences: Preferences): Selection => ({
  genres: preferences.genres.map(({ slug }) => slug),
  themes: preferences.themes.map(({ slug }) => slug),
  tags: preferences.tags.map(({ slug }) => slug),
});

function PreferencesForm({
  options,
  initial,
  next,
  onSaved,
}: {
  options: PreferenceOptions;
  initial: Preferences;
  next: string;
  onSaved: () => void;
}) {
  const [selection, setSelection] = useState<Selection>(() => slugsOf(initial));
  const [invalid, setInvalid] = useState<string | null>(null);
  const save = useSavePreferences();
  const count = selection.genres.length + selection.themes.length + selection.tags.length;

  // O aviso do envio anterior sai quando a escolha muda.
  const toggle = (group: Group, slug: string) => {
    setInvalid(null);
    setSelection((previous) => ({
      ...previous,
      [group]: previous[group].includes(slug)
        ? previous[group].filter((chosen) => chosen !== slug)
        : [...previous[group], slug],
    }));
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = PreferencesInputSchema.safeParse(selection);
    if (!parsed.success) {
      setInvalid(parsed.error.issues[0]!.message);
      return;
    }
    setInvalid(null);
    save.mutate(parsed.data, { onSuccess: onSaved });
  };

  const error = invalid ?? (save.isError ? errorMessage(save.error) : null);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <p>
        Escolha pelo menos {PREFERENCES_MIN} gêneros, temas ou etiquetas. Eles dão a partida nas
        suas recomendações, e você pode mudá-los quando quiser.
      </p>
      <ChoiceGroup
        legend="Gêneros"
        choices={options.genres}
        selected={selection.genres}
        onToggle={(slug) => toggle('genres', slug)}
      />
      <ChoiceGroup
        legend="Temas"
        choices={options.themes}
        selected={selection.themes}
        onToggle={(slug) => toggle('themes', slug)}
      />
      <TagGroup
        choices={options.tags}
        selected={selection.tags}
        onToggle={(slug) => toggle('tags', slug)}
      />
      <div className="sticky bottom-0 space-y-2 border-t bg-background py-3">
        <p aria-live="polite" className="text-sm">
          {count} {count === 1 ? 'escolhido' : 'escolhidos'} (mínimo {PREFERENCES_MIN})
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Salvando…' : 'Continuar'}
          </Button>
          <Link href={next} className="text-sm underline">
            Agora não
          </Link>
        </div>
      </div>
    </form>
  );
}

function ChoiceGroup({
  legend,
  description,
  choices,
  selected,
  onToggle,
  children,
}: {
  legend: string;
  description?: string;
  choices: FeatureOption[];
  selected: string[];
  onToggle: (slug: string) => void;
  children?: ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium">{legend}</legend>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      {children}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
        {choices.map(({ slug, name }) => (
          <label key={slug} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(slug)}
              onChange={() => onToggle(slug)}
            />
            {name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// De início, as mais frequentes no catálogo e as já escolhidas; a busca procura em todas, também
// pelos nomes de antes.
function TagGroup({
  choices,
  selected,
  onToggle,
}: {
  choices: FeatureOption[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const searchId = useId();
  const term = normalized(search.trim());

  const frequent = new Set(
    [...choices]
      .sort((a, b) => b.gameCount - a.gameCount || a.name.localeCompare(b.name, 'pt-BR'))
      .slice(0, TAGS_INITIAL)
      .map(({ slug }) => slug),
  );
  const shown =
    term !== ''
      ? choices.filter(({ name, aliases = [] }) =>
          [name, ...aliases].some((label) => normalized(label).includes(term)),
        )
      : showAll
        ? choices
        : choices.filter(({ slug }) => frequent.has(slug) || selected.includes(slug));

  return (
    <ChoiceGroup
      legend="Etiquetas da comunidade Steam"
      description="Descrevem o jogo de um jeito mais específico, como Roguelike ou Aconchegante."
      choices={shown}
      selected={selected}
      onToggle={onToggle}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor={searchId} className="block text-xs text-muted-foreground">
            Buscar etiqueta
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 w-56 max-w-full rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </div>
        {!showAll && term === '' && (
          <Button type="button" size="sm" variant="outline" onClick={() => setShowAll(true)}>
            Ver todas ({choices.length})
          </Button>
        )}
      </div>
      {term !== '' && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma etiqueta com esse nome.</p>
      )}
    </ChoiceGroup>
  );
}
