'use client';

import { GAMES_FILTER_MAX_VALUES } from '@indie/contracts';
import { useId, useState } from 'react';

export type Choice = { value: string; label: string };

const normalized = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

// A busca só esconde as opções: as marcadas continuam no formulário, mesmo fora do filtro, e o
// campo de busca não tem name, então não vai para a URL.
export function ChoiceList({
  legend,
  name,
  choices,
  selected,
  searchLabel,
}: {
  legend: string;
  name: string;
  choices: Choice[];
  selected: string[];
  searchLabel?: string;
}) {
  const [search, setSearch] = useState('');
  const searchId = useId();
  const term = normalized(search.trim());
  const shown = (label: string) => term === '' || normalized(label).includes(term);

  return (
    <details open={selected.length > 0} className="rounded-md border px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium">
        {legend}
        {selected.length > 0 && ` (${selected.length})`}
      </summary>
      {searchLabel && (
        <div className="mt-2 space-y-1">
          <label htmlFor={searchId} className="text-xs text-muted-foreground">
            {searchLabel}
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
          />
        </div>
      )}
      <fieldset className="mt-2 max-h-64 space-y-1 overflow-y-auto">
        <legend className="mb-1 text-xs text-muted-foreground">
          {legend}: escolha até {GAMES_FILTER_MAX_VALUES}
        </legend>
        {choices.map(({ value, label }) => (
          <label key={value} hidden={!shown(label)} className="flex items-center gap-2 text-sm">
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
