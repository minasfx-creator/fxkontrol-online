/**
 * SwarmGPT 2.0 — Type definitions.
 *
 * Module is isolated. No runtime, no firing, no timeline mutation here.
 * IA outputs flow: refiner → planner → critic → enhancer → validator → repair → compiler.
 */

export type Vec3 = { x: number; y: number; z: number };

export type SwarmStyle =
  | 'cinematic'
  | 'epic'
  | 'luxury'
  | 'festival'
  | 'corporate'
  | 'emotional'
  | 'futuristic';

export type EnergyCurve =
  | 'slow_build'
  | 'waves'
  | 'constant'
  | 'climax'
  | 'opening_climax';

export type FormationShape =
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

export type TransitionType =
  | 'morph'
  | 'fade'
  | 'wave'
  | 'spiral'
  | 'explode'
  | 'gather';

export interface SwarmGPTBounds {
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
  bounds: SwarmGPTBounds;
  style?: SwarmStyle;
  bpm?: number;
}

export interface RefinedPrompt {
  originalPrompt: string;
  refinedPrompt: string;
  creativeIntent: string;
  style: SwarmStyle;
  energyCurve: EnergyCurve;
  keyMoments: number[];
  constraints: string[];
}

export interface DroneFormation {
  id: string;
  name: string;
  shape: FormationShape;
  startTime: number;
  duration: number;
  points: Vec3[];
  color?: string;
  description?: string;
}

export interface DroneTransition {
  id: string;
  fromFormationId: string;
  toFormationId: string;
  type: TransitionType;
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

export type CritiqueIssueSeverity = 'low' | 'medium' | 'high';

export interface CritiqueIssue {
  severity: CritiqueIssueSeverity;
  category: 'timing' | 'geometry' | 'creativity' | 'safety' | 'clarity' | 'feasibility';
  message: string;
  suggestedFix: string;
}

export interface ChoreographyCritique {
  score: number;
  issues: CritiqueIssue[];
  improvementBrief: string;
}

export interface ValidationIssue {
  severity: 'warning' | 'error';
  code: string;
  message: string;
  path?: string;
}

export interface ValidationReport {
  ok: boolean;
  issues: ValidationIssue[];
}

export interface TimelineCue {
  id: string;
  type: 'drone_formation' | 'drone_transition';
  startTime: number;
  duration: number;
  payload: unknown;
}

export type SwarmGPTResult =
  | {
      ok: true;
      refinedPrompt: RefinedPrompt;
      plan: ChoreographyPlan;
      critique: ChoreographyCritique;
      validation: ValidationReport;
      timelineCues: TimelineCue[];
    }
  | {
      ok: false;
      refinedPrompt?: RefinedPrompt;
      plan?: ChoreographyPlan;
      critique?: ChoreographyCritique;
      validation?: ValidationReport;
      error: string;
    };
