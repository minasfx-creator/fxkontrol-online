/**
 * Provider local: encapsula o gerador determinístico (mulberry32 + hash).
 * Funciona offline, sem API keys, e serve como fallback seguro.
 */
import { generateShowPlanFromPrompt } from './generateShowPlan';
import type { GenerateShowPlanInput, ShowPlanProvider } from './aiShowPlanProvider';
import type { ShowPlan } from './types';

export const localShowPlanProvider: ShowPlanProvider = {
  id: 'local-deterministic',
  label: 'Gerador local (determinístico)',
  async generate(input: GenerateShowPlanInput): Promise<ShowPlan> {
    return generateShowPlanFromPrompt(input.prompt, input.site, input.variationSeed ?? 0);
  },
};
