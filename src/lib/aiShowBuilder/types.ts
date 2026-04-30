/**
 * Assistente de Coreografia IA — tipos centrais.
 *
 * Plano determinístico, inspecionável e validável ANTES de tocar no
 * `useProjectStore`. O store só é alterado pelo `materializeShowPlan`.
 *
 * Sem dependências externas. Sem `any`.
 */

export type ShowType = 'drones' | 'pyro' | 'hybrid';
export type AudiencePosition = 'front' | 'left' | 'right' | '360';
export type ShowIntensity = 'low' | 'medium' | 'high';

export interface ShowSiteConfig {
  name: string;
  width: number;        // metros (eixo X)
  depth: number;        // metros (eixo Z, profundidade do palco)
  maxHeight: number;    // metros (eixo Y)
  safetyDistance: number;
  audiencePosition: AudiencePosition;
  showType: ShowType;
}

export interface PlannedPosition {
  id: string;
  name: string;
  type: 'drone' | 'pyro' | 'anchor';
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  color: string;
}

export interface PlannedTimelineItem {
  id: string;
  type: 'drone_move' | 'pyro_effect' | 'finale' | 'marker';
  label: string;
  effectId?: string;
  startTime: number;
  duration?: number;
  positionId?: string;
  positionName?: string;
  notes?: string;
  intensity?: ShowIntensity;
}

export interface PlannedWaypoint {
  x: number;
  y: number;
  z: number;
  time: number;
}

export interface PlannedTrajectory {
  id: string;
  name: string;
  positionId: string | null;
  waypoints: PlannedWaypoint[];
}

export interface ShowSection {
  id: string;
  name: string;
  startTime: number;
  duration: number;
  intensity: ShowIntensity;
  description: string;
}

export interface ShowPlan {
  id: string;
  title: string;
  duration: number;
  intent: string;
  style: string;
  site: ShowSiteConfig;
  sections: ShowSection[];
  positions: PlannedPosition[];
  timelineItems: PlannedTimelineItem[];
  trajectories: PlannedTrajectory[];
  safetyWarnings: string[];
  assumptions: string[];
}

export interface ShowPlanValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Default site usado quando o usuário pula o setup. */
export const DEFAULT_SITE_CONFIG: ShowSiteConfig = {
  name: 'Local não definido',
  width: 240,
  depth: 120,
  maxHeight: 120,
  safetyDistance: 20,
  audiencePosition: 'front',
  showType: 'hybrid',
};
