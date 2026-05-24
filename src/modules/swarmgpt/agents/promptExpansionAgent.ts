/**
 * SwarmGPT 3.0 — Prompt Expansion Agent.
 *
 * Takes the raw user prompt and generates N distinct creative directions,
 * each representing a different artistic interpretation of the brief.
 * Downstream, the Prompt Selector chooses the most viable direction
 * before planning begins.
 *
 * Generating N perspectives before planning prevents the pipeline from
 * committing to one interpretation that may miss the user's intent.
 */
import type { PromptExpansionResult, SwarmGPTInput } from '../types';
import type { SwarmGPT3Config } from '../config';
import { PromptExpansionResultSchema } from '../schemas';

export async function promptExpansionAgent(
  input: SwarmGPTInput,
  config: SwarmGPT3Config,
): Promise<PromptExpansionResult> {
  const n = Math.max(1, Math.min(5, config.promptVariants));

  const system = `
You are a world-class drone show creative director with deep knowledge of
aerial choreography, event staging, and narrative storytelling through light.

Your job is to explore DIVERSE creative directions for a drone show brief.
Each variant must be meaningfully different — not just minor re-wordings.
Consider different: emotional arcs, visual metaphors, pacing strategies,
formation themes, and storytelling approaches.

After generating the variants, select the single most viable direction given
the operational constraints (drone count, duration, airspace bounds).

Return ONLY valid JSON. No markdown, no commentary.
`.trim();

  const user = JSON.stringify(
    {
      task: `Generate ${n} distinct creative directions for this drone show, then select the best.`,
      input,
      operationalConstraints: {
        droneCount: input.droneCount,
        durationSeconds: input.duration,
        airspaceBounds: input.bounds,
        bpm: input.bpm ?? null,
      },
      requiredOutput: {
        variants: Array.from({ length: n }, (_, i) => ({
          id: `v${i + 1}`,
          direction: 'string — short evocative title for this creative arc',
          style: 'cinematic | epic | luxury | festival | corporate | emotional | futuristic',
          energyCurve: 'slow_build | waves | constant | climax | opening_climax',
          keyMoments: 'number[] — seconds into show where major visual events occur',
          rationale: 'string — why this direction serves the prompt given the constraints',
        })),
        selectedVariantId: 'string — id of the chosen variant',
        selectionRationale: 'string — why this variant is the strongest choice',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'prompt_expander', system, user });
  return PromptExpansionResultSchema.parse(raw) as PromptExpansionResult;
}
