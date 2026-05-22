/**
 * SwarmGPT 2.0 — Shared domain types.
 * Mirrors the Zod schemas in `./schemas.ts` (which remain the runtime source of truth).
 */

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface SwarmGPTInput {
  prompt: string;
  droneCount: number;
  duration: number;
  bounds: Bounds;
  bpm?: number;
}

export type SwarmGPTStyle =
  | 'cinematic'
  | 'epic'
  | 'luxury'
  | 'festival'
  | 'corporate'
  | 'emotional'
  | 'futuristic';

export type SwarmGPTEnergyCurve =
  | 'slow_build'
  | 'waves'
  | 'constant'
  | 'climax'
  | 'opening_climax';

export interface RefinedPrompt {
  originalPrompt: string;
  refinedPrompt: string;
  creativeIntent: string;
  style: SwarmGPTStyle;
  energyCurve: SwarmGPTEnergyCurve;
  keyMoments: number[];
  constraints: string[];
}

export type DroneFormationShape =
  | 'circle'
  | 'sphere'
  | 'heart'
  | 'logo_placeholder'
  | 'text_placeholder'
  | 'wave'
  | 'spiral'
  | 'grid'
  | 'line'
  | 'custom';

export interface DroneFormation {
  id: string;
  name: string;
  shape: DroneFormationShape;
  startTime: number;
  duration: number;
  points: Vec3[];
  color?: string;
  description?: string;
}

export type DroneTransitionType =
  | 'morph'
  | 'fade'
  | 'wave'
  | 'spiral'
  | 'explode'
  | 'gather';

export interface DroneTransition {
  id: string;
  fromFormationId: string;
  toFormationId: string;
  type: DroneTransitionType;
  startTime: number;
  duration: number;
}

export interface ChoreographyPlan {
  version: 'swarmgpt-2.0';
  title: string;
  duration: number;
  droneCount: number;
  formations: DroneFormation[];
  transitions: DroneTransition[];
  notes: string[];
}

export type ChoreographyIssueSeverity = 'low' | 'medium' | 'high';
export type ChoreographyIssueCategory =
  | 'timing'
  | 'geometry'
  | 'creativity'
  | 'safety'
  | 'clarity'
  | 'feasibility';

export interface ChoreographyCritiqueIssue {
  severity: ChoreographyIssueSeverity;
  category: ChoreographyIssueCategory;
  message: string;
  suggestedFix: string;
}

export interface ChoreographyCritique {
  score: number;
  issues: ChoreographyCritiqueIssue[];
  improvementBrief: string;
}

export type ValidationSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

export type TimelineCueType = 'drone_formation' | 'drone_transition';

export interface TimelineCue {
  id: string;
  type: TimelineCueType;
  startTime: number;
  duration: number;
  payload: Record<string, unknown>;
}

export interface SwarmGPTResult {
  ok: boolean;
  refinedPrompt?: RefinedPrompt;
  plan?: ChoreographyPlan;
  critique?: ChoreographyCritique;
  validation?: ValidationReport;
  timelineCues?: TimelineCue[];
  error?: string;
}
