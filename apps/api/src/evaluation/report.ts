import { DiscoveryMode } from '../generated/prisma/client';
import type { CriteriaResult, Shelf } from './criteria';
import type { Difference, Interval } from './metrics';
import type { Family, Sampling } from './profiles';
import { ALL, type ComparisonResult, type GroupResult } from './results';
import type { Check, RuleResult, Unit, UpcomingRecord } from './rules';
import type { Method } from './run';

export interface EvaluationReport {
  title: string;
  meta: Record<string, string | number>;
  profiles: readonly {
    family: Family;
    sampling: Sampling | null;
    stratum: string;
    count: number;
    attributes?: number;
  }[];
  cutoffs: readonly number[];
  groups: readonly GroupResult[];
  comparisons: readonly ComparisonResult[];
  criteria: CriteriaResult | null;
}

export interface Round2Report {
  title: string;
  meta: Record<string, string | number>;
  rules: readonly RuleResult[];
  upcoming: readonly UpcomingRecord[];
  // O valor escolhido de cada parâmetro, depois das quatro regras.
  chosen: Record<string, string>;
}

const FAMILY: Record<Family, string> = {
  attribute: 'A, por atributo',
  coherent: 'B, coerentes',
  'cold-start': 'C, partida a frio',
  seed: 'D, semente 71',
};

const SAMPLING: Record<Sampling, string> = {
  uniform: 'uniforme',
  popularity: 'pela popularidade',
};

const STRATUM: Record<string, string> = {
  [ALL]: 'todos',
  GENRE: 'gênero',
  THEME: 'tema',
  TAG: 'etiqueta',
  rated: 'por avaliações',
  preferred: 'por preferências',
};

const MODE: Record<DiscoveryMode, string> = {
  POPULAR: 'Populares',
  BALANCED: 'Equilibrado',
  DISCOVERY: 'Descobertas',
};

const COMPARED: Record<string, string> = {
  single: 'lista única',
  random: 'aleatório',
  popular: 'populares dos gêneros e temas',
};

export function methodLabel(method: Method): string {
  if (method === 'random') return 'Aleatório';
  if (method === 'popular') return 'Populares dos gêneros e temas (alternativa 1)';
  const [mode, kind] = method.split('/') as [DiscoveryMode, string];
  return `${MODE[mode]}, ${kind === 'interleaved' ? 'intercalada' : 'lista única'}`;
}

const percent = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? '—'
    : `${(value * 100).toFixed(digits).replace('.', ',')}%`;

const decimal = (value: number | null, digits = 3) =>
  value === null ? '—' : value.toFixed(digits).replace('.', ',');

const points = (value: number) => {
  const text = (value * 100).toFixed(2).replace('.', ',');
  return value > 0 ? `+${text}` : text;
};

export function differenceText(difference: Difference | null): string {
  if (difference === null) return '—';
  return `${points(difference.difference)} [${points(difference.low)}; ${points(difference.high)}]`;
}

const groupName = ({
  family,
  sampling,
  stratum,
}: Pick<GroupResult, 'family' | 'sampling' | 'stratum'>) =>
  [
    FAMILY[family],
    sampling === null ? null : SAMPLING[sampling],
    stratum === ALL ? null : (STRATUM[stratum] ?? stratum),
  ]
    .filter((part) => part !== null)
    .join(', ');

const table = (header: readonly string[], rows: readonly (readonly string[])[]) => [
  `| ${header.join(' | ')} |`,
  `| ${header.map(() => '---').join(' | ')} |`,
  ...rows.map((row) => `| ${row.join(' | ')} |`),
];

export function renderReport(report: EvaluationReport): string {
  const { cutoffs } = report;
  const depth = Math.max(...cutoffs);
  const lines: string[] = [`# ${report.title}`, ''];
  for (const [key, value] of Object.entries(report.meta)) lines.push(`- **${key}:** ${value}`);

  lines.push('', '## Perfis', '');
  lines.push(
    ...table(
      ['Família', 'Amostragem', 'Estrato', 'Perfis', 'Atributos'],
      report.profiles.map(({ family, sampling, stratum, count, attributes }) => [
        FAMILY[family],
        sampling === null ? '—' : SAMPLING[sampling],
        STRATUM[stratum] ?? stratum,
        String(count),
        attributes === undefined ? '—' : String(attributes),
      ]),
    ),
  );

  lines.push('', `## Métricas por família (@${depth}, acerto em @${cutoffs.join(' e @')})`);
  for (const group of report.groups.filter(({ stratum }) => stratum === ALL)) {
    lines.push('', `### ${groupName(group)}`, '');
    lines.push(`${group.profiles} perfis, ${group.holdouts} jogos escondidos.`, '');
    const hasHits = group.holdouts > 0;
    const hasPreferences = group.methods.some(({ list }) => list.preferenceCoverage !== null);
    lines.push(
      ...table(
        [
          'Método',
          ...(hasHits ? cutoffs.map((k) => `Acerto@${k}`) : []),
          `Cobertura do catálogo@${depth}`,
          `ARP@${depth}`,
          `Em breve@${depth}`,
          `Interesses@${depth}`,
          `Gêneros e temas@${depth}`,
          ...(hasPreferences ? [`Preferências@${depth}`] : []),
          `Pouco conhecido@${depth}`,
        ],
        group.methods.map(({ method, hit, list, lowKnown }) => [
          methodLabel(method),
          ...(hasHits ? cutoffs.map((k) => percent(hit[k], 2)) : []),
          percent(list.catalogCoverage),
          decimal(list.averagePopularity),
          percent(list.upcoming),
          percent(list.interestCoverage),
          percent(list.genreThemeCoverage),
          ...(hasPreferences ? [percent(list.preferenceCoverage)] : []),
          percent(lowKnown),
        ]),
      ),
    );
    lines.push(
      '',
      `Sobreposição das intercaladas: Equilibrado × Descobertas ${percent(group.overlap.balancedDiscovery)}; Populares × Equilibrado ${percent(group.overlap.popularBalanced)}.`,
    );
  }

  const strata = report.groups.filter(
    ({ family, stratum }) => family === 'attribute' && stratum !== ALL,
  );
  if (strata.length > 0) {
    lines.push('', '## Acerto por tipo de atributo (família A)', '');
    const types = [...new Set(strata.map(({ stratum }) => stratum))];
    for (const sampling of [...new Set(strata.map(({ sampling }) => sampling))]) {
      const ofSampling = strata.filter((group) => group.sampling === sampling);
      lines.push(`**Amostragem ${SAMPLING[sampling!]}**`, '');
      lines.push(
        ...table(
          ['Método', ...types.flatMap((type) => cutoffs.map((k) => `${STRATUM[type]} @${k}`))],
          ofSampling[0]!.methods.map(({ method }) => [
            methodLabel(method),
            ...types.flatMap((type) => {
              const result = ofSampling
                .find(({ stratum }) => stratum === type)!
                .methods.find((m) => m.method === method)!;
              return cutoffs.map((k) => percent(result.hit[k], 2));
            }),
          ]),
        ),
        '',
      );
    }
  }

  if (report.comparisons.length > 0) {
    lines.push(
      '',
      '## Diferenças de acerto com intervalo de 95%',
      '',
      'Em pontos percentuais: diferença [limite inferior; limite superior], pelo bootstrap pareado sobre os perfis.',
      '',
    );
    lines.push(
      ...table(
        ['Grupo', 'Lista', 'Comparada com', ...cutoffs.map((k) => `@${k}`)],
        report.comparisons.map((comparison) => [
          groupName(comparison),
          methodLabel(comparison.a),
          COMPARED[comparison.label] ?? comparison.label,
          ...cutoffs.map((k) => differenceText(comparison.difference[k] ?? null)),
        ]),
      ),
    );
  }

  if (report.criteria !== null) lines.push('', ...renderCriteria(report.criteria));
  return `${lines.join('\n')}\n`;
}

const shelfText = ({ name, documentRatio, support }: Shelf) =>
  `${name} (${percent(documentRatio)}; ${support} jogo${support === 1 ? '' : 's'})`;

const verdict = (passes: boolean) => (passes ? 'passa' : 'não passa');

function renderCriteria(criteria: CriteriaResult): string[] {
  return [
    '## Critérios C1 a C5 (modo Equilibrado)',
    '',
    `Caso RPG com terror (${criteria.regression.games.join(', ')}): ${criteria.regression.shelves.map(shelfText).join('; ') || 'nenhuma prateleira'}.`,
    '',
    ...criteria.realistic.map(
      ({ title, shelves, passes }) =>
        `- **${title}:** ${shelves.map(shelfText).join('; ') || 'nenhuma'} (${verdict(passes)})`,
    ),
    '',
    ...table(
      ['Critério', 'Resultado'],
      [
        ['C1 original (registro)', verdict(criteria.c1Original)],
        ['C1 revisado', verdict(criteria.c1Revised)],
        ['C2, Amnesia', verdict(criteria.c2)],
        ['C3, perfis realistas', verdict(criteria.c3)],
        [
          'C4, preferências',
          `${criteria.c4.passing} de ${criteria.c4.total} (${verdict(criteria.c4.passing === criteria.c4.total)})`,
        ],
        ['C5 (a)', `${percent(criteria.c5.main)} (${verdict(criteria.c5Passes.main)})`],
        ['C5 (b)', `${percent(criteria.c5.second)} (${verdict(criteria.c5Passes.second)})`],
        ['C5 (c)', `${percent(criteria.c5.none)} (${verdict(criteria.c5Passes.none)})`],
        [
          'Ideia repetida',
          criteria.repeatedIdeas === 0
            ? 'nenhuma (passa)'
            : `${criteria.repeatedIdeas} perfis (não passa)`,
        ],
        [
          'Especificidade: frequência mediana das prateleiras mostradas',
          `${percent(criteria.specificity.median)} em ${criteria.specificity.shelves} prateleiras; ${percent(criteria.specificity.aboveTenPercent)} acima de 10%`,
        ],
      ],
    ),
  ];
}

const valueText = (value: number, unit: Unit) => {
  if (!Number.isFinite(value)) return '∞';
  if (unit === 'points') return points(value);
  if (unit === 'percent') return percent(value);
  return decimal(value, unit === 'ratio' ? 2 : 3);
};

export function intervalText(interval: Interval | null, unit: Unit): string {
  if (interval === null) return '—';
  const { value, low, high } = interval;
  return `${valueText(value, unit)} [${valueText(low, unit)}; ${valueText(high, unit)}]`;
}

function thresholdText({ threshold, side, unit }: Check): string {
  if (threshold === null || side === null) return '—';
  const value =
    unit === 'points' ? points(threshold).replace(/^\+/, '') : valueText(threshold, unit);
  return {
    above: `inteiro acima de ${value}`,
    atLeast: `inteiro ≥ ${value}`,
    atMost: `inteiro ≤ ${value}`,
    notBelow: `não inteiro abaixo de ${value}`,
  }[side];
}

function renderRule(rule: RuleResult): string[] {
  const lines = [
    `## Regra ${rule.rule}: ${rule.title}`,
    '',
    `- **Atual:** ${rule.current}`,
    `- **Escolhido:** ${rule.chosen}`,
    `- **Por quê:** ${rule.note}`,
    '',
  ];
  if (rule.candidates.every(({ checks }) => checks.every(({ group }) => group === null))) {
    lines.push(
      ...table(
        ['Critério', ...rule.candidates.map(({ name }) => name)],
        rule.candidates[0]!.checks.map(({ condition }, i) => [
          condition,
          ...rule.candidates.map(({ checks }) => verdict(checks[i]!.passes)),
        ]),
      ),
    );
    return lines;
  }
  const reserve = rule.candidates.some(({ eligible }) => eligible !== undefined);
  lines.push(
    ...table(
      [
        'Valor',
        'Passa',
        'Condições que falham',
        ...(reserve ? ['Cumpre o que o atual cumpre'] : []),
      ],
      rule.candidates.map(({ name, passes, checks, eligible }) => [
        name,
        passes ? 'sim' : 'não',
        String(checks.filter((check) => !check.passes).length) + ` de ${checks.length}`,
        ...(reserve ? [eligible ? 'sim' : 'não'] : []),
      ]),
    ),
  );
  for (const { name, checks } of rule.candidates) {
    lines.push('', `### ${name}`, '');
    lines.push(
      ...table(
        ['Grupo', 'Condição', 'Valor [intervalo de 95%]', 'Limiar', 'Resultado'],
        checks.map((check) => [
          check.group === null ? '—' : groupName(check.group),
          check.condition,
          intervalText(check.interval, check.unit),
          thresholdText(check),
          verdict(check.passes),
        ]),
      ),
    );
  }
  return lines;
}

export function renderRound2(report: Round2Report): string {
  const lines: string[] = [`# ${report.title}`, ''];
  for (const [key, value] of Object.entries(report.meta)) lines.push(`- **${key}:** ${value}`);
  lines.push('', '## Configuração escolhida', '');
  lines.push(...table(['Parâmetro', 'Valor'], Object.entries(report.chosen)));
  for (const rule of report.rules) lines.push('', ...renderRule(rule));
  for (const rule of report.rules.filter(({ candidates }) => candidates.some((c) => c.criteria))) {
    for (const { name, criteria } of rule.candidates.filter((c) => c.criteria)) {
      lines.push('', `## Critérios C1 a C5 (registro), regra ${rule.rule}: ${name}`, '');
      lines.push(...renderCriteria(criteria!).slice(2));
    }
  }
  lines.push('', '## "Em breve" no top-20, com a configuração escolhida', '');
  lines.push(
    ...table(
      ['Grupo', 'Modo', 'Em breve', 'Domina'],
      report.upcoming.map(({ mode, share, dominates, ...group }) => [
        groupName(group),
        MODE[mode],
        percent(share),
        dominates ? 'sim' : 'não',
      ]),
    ),
  );
  return `${lines.join('\n')}\n`;
}
