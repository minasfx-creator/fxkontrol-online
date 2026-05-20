/**
 * Demo Shows registry barrel.
 * Kept because Toolbar.tsx lazy-imports `getDemoShow` from here.
 */
import {
  ANIVERSARIO_ANGRA_ID,
  buildAniversarioAngraShow,
  ANIVERSARIO_ANGRA_DURATION_S,
} from './aniversarioAngraDemo';
import {
  FESTIVAL_DEMO_ID,
  buildFestivalMainStageDemo,
  FESTIVAL_DEMO_DURATION_S,
} from './festivalMainStageDemo';
import type { ShowPlan } from '@/core/showplan/ShowPlan';

export interface DemoShowEntry {
  id: string;
  label: string;
  durationS: number;
  build: () => ShowPlan;
}

export const DEMO_SHOWS: DemoShowEntry[] = [
  {
    id: ANIVERSARIO_ANGRA_ID,
    label: 'Aniversário Angra',
    durationS: ANIVERSARIO_ANGRA_DURATION_S,
    build: buildAniversarioAngraShow,
  },
  {
    id: FESTIVAL_DEMO_ID,
    label: 'Festival Main Stage',
    durationS: FESTIVAL_DEMO_DURATION_S,
    build: buildFestivalMainStageDemo,
  },
];

export function getDemoShow(id: string): DemoShowEntry | undefined {
  return DEMO_SHOWS.find((d) => d.id === id);
}

export { buildAniversarioAngraShow, buildFestivalMainStageDemo };
