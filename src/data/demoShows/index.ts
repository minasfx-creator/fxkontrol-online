/**
 * Demo show catalog — registry of seed shows loadable from the editor.
 */
import type { ShowPlan } from '@/core/showplan/ShowPlan';
import {
  buildFestivalMainStageDemo,
  FESTIVAL_DEMO_ID,
  FESTIVAL_DEMO_DURATION_S,
  FESTIVAL_DEMO_MANIFEST,
} from './festivalMainStageDemo';
import {
  buildAniversarioAngraShow,
  ANIVERSARIO_ANGRA_ID,
  ANIVERSARIO_ANGRA_DURATION_S,
  ANIVERSARIO_ANGRA_MANIFEST,
} from './aniversarioAngraDemo';

export interface DemoShowEntry {
  id: string;
  label: string;
  description: string;
  durationS: number;
  provenance: 'pilot' | 'validated' | 'marketing_hypothesis';
  build: () => ShowPlan;
}

export const DEMO_SHOWS: DemoShowEntry[] = [
  {
    id: FESTIVAL_DEMO_ID,
    label: 'Festival Main Stage',
    description: '120 cues / 32 drones / 16 movers — Maracanã (marketing hypothesis)',
    durationS: FESTIVAL_DEMO_DURATION_S,
    provenance: FESTIVAL_DEMO_MANIFEST.provenance,
    build: buildFestivalMainStageDemo,
  },
  {
    id: ANIVERSARIO_ANGRA_ID,
    label: 'Aniversário Angra',
    description: '110 cues / 4× FireOne FM / 2 posições — pilot import',
    durationS: ANIVERSARIO_ANGRA_DURATION_S,
    provenance: ANIVERSARIO_ANGRA_MANIFEST.provenance,
    build: buildAniversarioAngraShow,
  },
];

export function getDemoShow(id: string): DemoShowEntry | undefined {
  return DEMO_SHOWS.find((d) => d.id === id);
}
