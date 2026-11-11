'use client';

import { ONBOARDING_RATINGS_MAX } from '@indie/contracts';
import { useEffect, useRef, useState } from 'react';
import { SessionGate } from '@/features/recommendations/recommendation-states';
import { onboardingHref } from './paths';
import { PreferencesStep } from './preferences-step';
import { RatingStep } from './rating-step';

type Step = 'preferences' | 'ratings';

const HEADINGS: Record<Step, string> = {
  preferences: 'Do que você gosta?',
  ratings: `Avalie até ${ONBOARDING_RATINGS_MAX} jogos que você já jogou`,
};

export function OnboardingView({ next }: { next: string }) {
  return (
    <SessionGate
      next={onboardingHref(next)}
      heading={<h1 className="text-2xl font-semibold">{HEADINGS.preferences}</h1>}
      invite="para escolher seus gostos."
    >
      {() => <Onboarding next={next} />}
    </SessionGate>
  );
}

// Gravadas as preferências, a partida a frio já está concluída: a etapa das notas é opcional.
function Onboarding({ next }: { next: string }) {
  const [step, setStep] = useState<Step>('preferences');
  const heading = useRef<HTMLHeadingElement>(null);
  const changedStep = useRef(false);

  // Na troca de etapa, o foco vai para o título novo, e a página volta ao topo.
  useEffect(() => {
    if (!changedStep.current) return;
    window.scrollTo({ top: 0 });
    heading.current?.focus();
  }, [step]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Etapa {step === 'preferences' ? 1 : 2} de 2</p>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold outline-none">
        {HEADINGS[step]}
      </h1>
      {step === 'preferences' ? (
        <PreferencesStep
          next={next}
          onSaved={() => {
            changedStep.current = true;
            setStep('ratings');
          }}
        />
      ) : (
        <RatingStep next={next} />
      )}
    </div>
  );
}
