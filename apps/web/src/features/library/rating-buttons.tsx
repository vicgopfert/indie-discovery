'use client';

import { RATING_MAX, RATING_MIN } from '@indie/contracts';
import { useId } from 'react';
import { Button } from '@/components/ui/button';

const SCORES = Array.from({ length: RATING_MAX - RATING_MIN + 1 }, (_, i) => RATING_MIN + i);

// groupLabel: o nome lido pelo leitor de tela, quando há várias notas na mesma página.
export function RatingButtons({
  score,
  disabled,
  groupLabel,
  onRate,
  onUnrate,
}: {
  score: number | null;
  disabled: boolean;
  groupLabel?: string;
  onRate: (score: number) => void;
  onUnrate: () => void;
}) {
  const labelId = useId();
  return (
    <div
      role="group"
      aria-labelledby={groupLabel ? undefined : labelId}
      aria-label={groupLabel}
      className="flex flex-wrap items-center gap-2"
    >
      <span id={labelId} className="text-sm">
        Sua nota
      </span>
      {SCORES.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={score === option ? 'default' : 'outline'}
          aria-pressed={score === option}
          disabled={disabled}
          onClick={() => score !== option && onRate(option)}
        >
          {option}
        </Button>
      ))}
      {score !== null && (
        <Button size="sm" variant="ghost" disabled={disabled} onClick={onUnrate}>
          Remover nota
        </Button>
      )}
    </div>
  );
}
