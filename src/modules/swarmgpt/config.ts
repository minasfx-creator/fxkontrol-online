/**
 * SwarmGPT 2.0 / 3.0 — LLM client abstraction & config.
 *
 * Module is provider-agnostic. UI/edge integration (Lovable AI Gateway) wires
 * the real `completeJson` impl later.
 *
 * SwarmGPT 2.0 model suggestions:
 *   refiner  → google/gemini-flash-2.5
 *   planner  → google/gemini-2.5-pro
 *   critic   → google/gemini-flash-2.5
 *   enhancer → google/gemini-2.5-pro
 *   repair   → google/gemini-flash-2.5
 *
 * SwarmGPT 3.0 additional roles:
 *   prompt_expander    → google/gemini-flash-2.5      (fast, creative breadth)
 *   prompt_selector    → google/gemini-flash-2.5      (fast, selection logic)
 *   creativity_critic  → google/gemini-2.5-pro        (deep artistic evaluation)
 *   safety_critic      → google/gemini-flash-2.5      (rule-based, fast)
 *   tech_critic        → google/gemini-flash-2.5      (schema/timing, fast)
 *   aggregate_critic   → google/gemini-flash-2.5      (synthesis, fast)
 *   devils_advocate    → google/gemini-2.5-pro        (adversarial depth)
 */

// ─── 2.0 roles ───────────────────────────────────────────────────────────────
export type SwarmGPTModelRole = 'refiner' | 'planner' | 'critic' | 'enhancer' | 'repair';

// ─── 3.0 extended roles ──────────────────────────────────────────────────────
export type SwarmGPT3ModelRole =
  | SwarmGPTModelRole
  | 'prompt_expander'
  | 'prompt_selector'
  | 'creativity_critic'
  | 'safety_critic'
  | 'tech_critic'
  | 'aggregate_critic'
  | 'devils_advocate';

export interface SwarmGPTLLMClient {
  completeJson: (args: {
    role: SwarmGPT3ModelRole;
    system: string;
    user: string;
  }) => Promise<unknown>;
}

// ─── 2.0 config ──────────────────────────────────────────────────────────────
export interface SwarmGPTConfig {
  llm: SwarmGPTLLMClient;
  /** Minimum euclidean distance (meters) between any two drones in a formation. */
  minDroneDistance: number;
  /** Max attempts of repair-agent loop before failing. */
  maxRepairAttempts: number;
  /** Max instantaneous drone speed (m/s) used by the trajectory optimizer. */
  maxDroneSpeed: number;
}

// ─── 3.0 config ──────────────────────────────────────────────────────────────
export interface SwarmGPT3Config extends SwarmGPTConfig {
  /** Number of prompt variants to explore in Phase 0. Default: 3. */
  promptVariants: number;
  /** Number of parallel plan candidates to generate in Phase 1. Default: 3. */
  parallelCandidates: number;
  /** Maximum critic→enhancer cycles before accepting the best result. Default: 3. */
  maxRefinementPasses: number;
  /**
   * Aggregate quality score (0–100) above which refinement loop exits early.
   * Default: 78. Set lower (e.g. 65) for speed, higher (e.g. 88) for quality.
   */
  minQualityScore: number;
  /** Run the Devil's Advocate adversarial review after refinement. Default: true. */
  enableAdversarialReview: boolean;
  /**
   * Weighting for specialist critics [creativity, safety, tech].
   * Must sum to 1.0. Default: [0.35, 0.35, 0.30].
   */
  criticWeights: [number, number, number];
}

/** Suggested model per role for SwarmGPT 3.0. */
export const DEFAULT_MODEL_BY_ROLE: Readonly<Record<SwarmGPT3ModelRole, string>> = Object.freeze({
  // ── 2.0 roles ──
  refiner:           'google/gemini-flash-2.5',
  planner:           'google/gemini-2.5-pro',
  critic:            'google/gemini-flash-2.5',
  enhancer:          'google/gemini-2.5-pro',
  repair:            'google/gemini-flash-2.5',
  // ── 3.0 roles ──
  prompt_expander:   'google/gemini-flash-2.5',
  prompt_selector:   'google/gemini-flash-2.5',
  creativity_critic: 'google/gemini-2.5-pro',
  safety_critic:     'google/gemini-flash-2.5',
  tech_critic:       'google/gemini-flash-2.5',
  aggregate_critic:  'google/gemini-flash-2.5',
  devils_advocate:   'google/gemini-2.5-pro',
});

export function createDefaultSwarmGPTConfig(llm: SwarmGPTLLMClient): SwarmGPTConfig {
  return {
    llm,
    minDroneDistance: 2.5,
    maxRepairAttempts: 2,
    maxDroneSpeed: 8.0,
  };
}

export function createDefaultSwarmGPT3Config(llm: SwarmGPTLLMClient): SwarmGPT3Config {
  return {
    llm,
    minDroneDistance: 2.5,
    maxRepairAttempts: 2,
    maxDroneSpeed: 8.0,
    promptVariants: 3,
    parallelCandidates: 3,
    maxRefinementPasses: 3,
    minQualityScore: 78,
    enableAdversarialReview: true,
    criticWeights: [0.35, 0.35, 0.30],
  };
}
