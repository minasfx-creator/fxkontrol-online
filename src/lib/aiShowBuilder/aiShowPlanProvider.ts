/**
 * AI Provider abstraction for ShowPlan generation.
 *
 * Permite trocar o motor (local determinístico, IA remota) sem reescrever
 * UI, validação ou materialização. Toda saída ainda DEVE passar por
 * validateShowPlan + preview antes de materializeShowPlan.
 */
import type { ShowPlan, ShowSiteConfig } from './types';

export interface GenerateShowPlanInput {
  prompt: string;
  site: ShowSiteConfig;
  variationSeed?: number;
}

export interface ShowPlanProvider {
  id: string;
  label: string;
  generate(input: GenerateShowPlanInput): Promise<ShowPlan>;
}
