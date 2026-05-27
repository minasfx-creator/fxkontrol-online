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

// ─────────────────────────────────────────────────────────────────────────────
// SwarmGPT 3.0 — Multi-Agent Refinement Pipeline types
// ─────────────────────────────────────────────────────────────────────────────

/** One creative direction generated during prompt expansion. */
export interface PromptVariant {
  id: string;
  /** Short narrative label, e.g. "Opening ceremony — national pride arc". */
  direction: string;
  style: SwarmGPTStyle;
  energyCurve: SwarmGPTEnergyCurve;
  keyMoments: number[];
  /** Why this direction serves the user prompt given the constraints. */
  rationale: string;
}

/** Output of the prompt expansion + selection phase. */
export interface PromptExpansionResult {
  variants: PromptVariant[];
  selectedVariantId: string;
  selectionRationale: string;
}

/** A plan candidate generated during parallel planning. */
export interface PlanCandidate {
  id: string;
  plan: ChoreographyPlan;
  variantId: string;
}

/** Output of one specialist critic (creativity / safety / tech). */
export interface SpecialistCritique {
  role: 'creativity' | 'safety' | 'tech';
  score: number;
  issues: ChoreographyCritiqueIssue[];
  summary: string;
}

/** Aggregate output from all specialist critics for a single plan. */
export interface MultiCritiqueResult {
  specialists: SpecialistCritique[];
  /** Weighted combination of specialist scores. */
  aggregateScore: number;
  /** Deduplicated, severity-escalated union of all issues. */
  combinedIssues: ChoreographyCritiqueIssue[];
  /** Unified improvement brief for the enhancer. */
  improvementBrief: string;
}

/** Record of one critic→enhance cycle. */
export interface RefinementIteration {
  pass: number;
  scoreBefore: number;
  scoreAfter: number;
  multiCritique: MultiCritiqueResult;
}

/** A single finding from the Devil's Advocate agent. */
export interface DevilsAdvocateFinding {
  risk: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation: string;
}

/** Full output of the adversarial review agent. */
export interface DevilsAdvocateReport {
  /** true when no critical or high-severity findings remain. */
  passed: boolean;
  findings: DevilsAdvocateFinding[];
  finalVerdict: string;
}

/** Pipeline phase identifier for progress tracking. */
export type PipelinePhase =
  | 'prompt_expansion'
  | 'parallel_planning'
  | 'candidate_selection'
  | 'refinement_loop'
  | 'adversarial_review'
  | 'validation'
  | 'post_processing'
  | 'compilation'
  | 'complete'
  | 'failed';

/** Emitted during pipeline execution for UI progress display. */
export interface PipelineProgressEvent {
  phase: PipelinePhase;
  message: string;
  /** Normalised 0–1 overall progress. */
  progress: number;
  /** Optional phase-specific payload (e.g. intermediate scores). */
  data?: unknown;
}

/** Callback signature for streaming progress to UI. */
export type PipelineProgressCallback = (event: PipelineProgressEvent) => void;

/** Extended result from the SwarmGPT 3.0 pipeline. */
export interface SwarmGPTResult3 {
  ok: boolean;
  expansion?: PromptExpansionResult;
  refinedPrompt?: RefinedPrompt;
  candidates?: PlanCandidate[];
  selectedCandidateId?: string;
  refinementIterations?: RefinementIteration[];
  finalCritique?: MultiCritiqueResult;
  devilsAdvocate?: DevilsAdvocateReport;
  plan?: ChoreographyPlan;
  validation?: ValidationReport;
  timelineCues?: TimelineCue[];
  totalPasses?: number;
  finalScore?: number;
  error?: string;
}
