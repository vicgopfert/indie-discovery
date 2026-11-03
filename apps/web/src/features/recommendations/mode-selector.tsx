import type { DiscoveryMode } from '@indie/contracts';
import { Button } from '@/components/ui/button';

const MODES: { mode: DiscoveryMode; label: string; description: string }[] = [
  { mode: 'POPULAR', label: 'Populares', description: 'jogos mais conhecidos primeiro' },
  { mode: 'BALANCED', label: 'Equilibrado', description: 'só pela afinidade com o seu gosto' },
  { mode: 'DISCOVERY', label: 'Descobertas', description: 'favorece jogos pouco conhecidos' },
];

// Botões de alternar, e não de opção: cada seta do teclado num grupo de opções gravaria um modo.
export function ModeSelector({
  mode,
  saving,
  onSelect,
}: {
  mode: DiscoveryMode;
  saving: boolean;
  onSelect: (mode: DiscoveryMode) => void;
}) {
  return (
    <div role="group" aria-labelledby="mode-label" className="space-y-2">
      <span id="mode-label" className="text-sm font-medium">
        Modo de descoberta
      </span>
      <div className="flex flex-wrap gap-4">
        {MODES.map(({ mode: option, label, description }) => (
          <div key={option} className="space-y-1">
            <Button
              size="sm"
              variant={option === mode ? 'default' : 'outline'}
              aria-pressed={option === mode}
              aria-describedby={`mode-${option}`}
              disabled={saving}
              onClick={() => option !== mode && onSelect(option)}
            >
              {label}
            </Button>
            <p id={`mode-${option}`} className="text-xs text-muted-foreground">
              {description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
