/**
 * Demo Shows registry barrel.
 * Kept because Toolbar.tsx lazy-imports `getDemoShow` from here.
 */
import { aniversarioAngraDemo } from './aniversarioAngraDemo';
import { festivalMainStageDemo } from './festivalMainStageDemo';
import type { ShowPlan } from '@/core/showplan/ShowPlan';

export interface DemoShowEntry {
  id: string;
  label: string;
  build: () => ShowPlan;
}

export const DEMO_SHOWS: DemoShowEntry[] = [
  { id: 'aniversario-angra', label: 'Aniversário Angra', build: aniversarioAngraDemo },
  { id: 'festival-main-stage', label: 'Festival Main Stage', build: festivalMainStageDemo },
];

export function getDemoShow(id: string): DemoShowEntry | undefined {
  return DEMO_SHOWS.find((d) => d.id === id);
}

export { aniversarioAngraDemo, festivalMainStageDemo };
