/**
 * SwarmGPT 2.0 — LLM client abstraction & config.
 *
 * Module is provider-agnostic. UI/edge integration (Lovable AI Gateway) wires
 * the real `completeJson` impl later. Suggested model mix per role:
 *   refiner  → google/gemini-3-flash-preview
 *   planner  → google/gemini-2.5-pro
 *   critic   → google/gemini-3-flash-preview
 *   enhancer → google/gemini-2.5-pro
 *   repair   → google/gemini-3-flash-preview
 */

export type SwarmGPTModelRole = 'refiner' | 'planner' | 'critic' | 'enhancer' | 'repair';

export interface SwarmGPTLLMClient {
  completeJson: (args: {
    role: SwarmGPTModelRole;
    system: string;
    user: string;
  }) => Promise<unknown>;
}

export interface SwarmGPTConfig {
  llm: SwarmGPTLLMClient;
  /** Minimum euclidean distance (meters) between any two drones in a formation. */
  minDroneDistance: number;
  /** Max attempts of repair-agent loop before failing. */
  maxRepairAttempts: number;
  /** Max instantaneous drone speed (m/s) used by the trajectory optimizer. */
  maxDroneSpeed: number;
}

/** Suggested model per role — consumed by the future edge function/dispatcher. */
export const DEFAULT_MODEL_BY_ROLE: Readonly<Record<SwarmGPTModelRole, string>> = Object.freeze({
  refiner: 'google/gemini-3-flash-preview',
  planner: 'google/gemini-2.5-pro',
  critic: 'google/gemini-3-flash-preview',
  enhancer: 'google/gemini-2.5-pro',
  repair: 'google/gemini-3-flash-preview',
});

export function createDefaultSwarmGPTConfig(llm: SwarmGPTLLMClient): SwarmGPTConfig {
  return {
    llm,
    minDroneDistance: 2.5,
    maxRepairAttempts: 2,
    maxDroneSpeed: 8.0,
  };
}
