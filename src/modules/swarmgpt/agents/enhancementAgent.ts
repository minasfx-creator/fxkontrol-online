/**
 * SwarmGPT 2.0 — Agent 4/4: Enhancement Agent.
 * Applies the critique and produces an improved plan.
 */
import type {
  ChoreographyCritique,
  ChoreographyPlan,
  RefinedPrompt,
  SwarmGPTInput,
} from '../types';
import type { SwarmGPTConfig } from '../config';
import { ChoreographyPlanSchema } from '../schemas';

export async function enhancementAgent(
  input: SwarmGPTInput,
  refined: RefinedPrompt,
  plan: ChoreographyPlan,
  critique: ChoreographyCritique,
  config: SwarmGPTConfig,
): Promise<ChoreographyPlan> {
  const system = `
You are a senior drone show improvement model.
Improve the plan based on the critique.
Return ONLY valid JSON matching the choreography plan schema.
Keep exactly droneCount points per formation.
Keep all times inside the show duration.
Preserve the creative intent.
Do not output executable flight instructions for real hardware.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Improve this choreography plan based on critique.',
      input,
      refinedPrompt: refined,
      originalPlan: plan,
      critique,
      requiredOutput: {
        version: 'swarmgpt-2.0',
        title: 'string',
        duration: input.duration,
        droneCount: input.droneCount,
        formations: 'DroneFormation[]',
        transitions: 'DroneTransition[]',
        notes: 'string[]',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'enhancer', system, user });
  return ChoreographyPlanSchema.parse(raw);
}
