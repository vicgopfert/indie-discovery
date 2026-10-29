import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

export type LabeledFeatureType = 'GENRE' | 'THEME';

const byType = <T extends z.ZodType>(value: T) => z.object({ GENRE: value, THEME: value });

export const featureLabelsConfigSchema = z.object({
  labelsRationale: z.string().min(1),
  labels: byType(z.record(z.string().min(1), z.string().trim().min(1))),
  hiddenFromFilters: byType(z.array(z.string().min(1))),
  hiddenRationale: z.string().min(1),
});

export type FeatureLabelsConfig = z.infer<typeof featureLabelsConfigSchema>;

export const FEATURE_LABELS_FILE = resolve(process.cwd(), 'config/feature-labels.json');

export class FeatureLabels {
  constructor(private readonly config: FeatureLabelsConfig) {}

  static fromFile(file = FEATURE_LABELS_FILE) {
    return new FeatureLabels(
      featureLabelsConfigSchema.parse(JSON.parse(readFileSync(file, 'utf8'))),
    );
  }

  name(type: LabeledFeatureType, slug: string, igdbName: string) {
    return this.config.labels[type][slug] ?? igdbName;
  }

  isHidden(type: LabeledFeatureType, slug: string) {
    return this.config.hiddenFromFilters[type].includes(slug);
  }
}
