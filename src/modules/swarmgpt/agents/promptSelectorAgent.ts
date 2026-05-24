/**
 * SwarmGPT 3.0 — Prompt Selector Agent.
 *
 * Given the expansion result (N variants), validates that the auto-selected
 * variant is truly the best choice from a planning-feasibility perspective.
 * If the expander's selection would be difficult to choreograph given the
 * constraints, the selector overrides it with the more feasible candidate.
 *
 * Also converts the winning variant into a `RefinedPrompt` compatible with
 * the SwarmGPT 2.0 planner agent format.
 */
import type { PromptExpansionResult, RefinedPrompt, SwarmGPTInput } from '../types';
import type { SwarmGPT3Config } from '../config';
import { RefinedPromptSchema } from '../schemas';

export interface PromptSelectionResult {
  selectedVariantId: string;
  refinedPrompt: RefinedPrompt;
}

const PromptSelectionResultShape = {
  selectedVariantId: 'string — id of the confirmed best variant',
  refinedPrompt: {
    originalPrompt: 'string',
    refinedPrompt: 'string — the full detailed choreography brief for the planner',
    creativeIntent: 'string — one sentence mission statement',
    style: 'cinematic | epic | luxury | festival | corporate | emotional | futuristic',
    energyCurve: 'slow_build | waves | constant | climax | opening_climax',
    keyMoments: 'number[] — key event timestamps in seconds',
    constraints: 'string[] — hard planning constraints derived from the brief',
  },
};

export async function promptSelectorAgent(
  input: SwarmGPTInput,
  expansion: PromptExpansionResult,
  config: SwarmGPT3Config,
): Promise<PromptSelectionResult> {
  const system = `
You are a senior drone show choreography consultant specialising in
feasibility assessment. Your task is to:

1. Review the creative variants and the pre-selected choice.
2. Confirm or override the selection based on planning feasibility —
   consider drone count, show duration, airspace bounds, and BPM.
3. Convert the chosen variant into a precise choreography brief that
   the planner agent can execute directly.

The brief must be specific: name formation shapes, describe colour palettes,
specify approximate timings for key moments, and call out any formation
sequences that require special treatment (e.g. text formations need
minimum 40 drones per character).

Return ONLY valid JSON. No markdown.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Confirm or override variant selection; produce a precise choreography brief.',
      input,
      expansion,
      requiredOutput: PromptSelectionResultShape,
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'prompt_selector', system, user });

  // Parse and validate the refined prompt portion
  const parsed = raw as { selectedVariantId?: unknown; refinedPrompt?: unknown };
  const refinedPrompt = RefinedPromptSchema.parse(parsed?.refinedPrompt) as RefinedPrompt;

  return {
    selectedVariantId:
      typeof parsed?.selectedVariantId === 'string'
        ? parsed.selectedVariantId
        : expansion.selectedVariantId,
    refinedPrompt,
  };
}
