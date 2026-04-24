/**
 * SwarmGPT 2.0 — Agent 1/4: Prompt Refiner.
 * Translates human prompt into a precise creative brief.
 */
import type { RefinedPrompt, SwarmGPTInput } from '../types';
import type { SwarmGPTConfig } from '../config';
import { RefinedPromptSchema } from '../schemas';

export async function promptRefinerAgent(
  input: SwarmGPTInput,
  config: SwarmGPTConfig,
): Promise<RefinedPrompt> {
  const system = `
You are a senior drone show creative director.
Convert the user prompt into a precise choreography brief.
Return ONLY valid JSON.
Do not include markdown.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Refine this prompt for a drone choreography AI.',
      input,
      requiredOutput: {
        originalPrompt: 'string',
        refinedPrompt: 'string',
        creativeIntent: 'string',
        style: 'cinematic | epic | luxury | festival | corporate | emotional | futuristic',
        energyCurve: 'slow_build | waves | constant | climax | opening_climax',
        keyMoments: 'number[]',
        constraints: 'string[]',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'refiner', system, user });
  return RefinedPromptSchema.parse(raw);
}
