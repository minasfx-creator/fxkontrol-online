/**
 * SwarmGPT 2.0 — Agent 3/4: Choreography Critic.
 * Scores and lists issues. Does NOT rewrite the plan.
 */
import type {
  ChoreographyCritique,
  ChoreographyPlan,
  RefinedPrompt,
  SwarmGPTInput,
} from '../types';
import type { SwarmGPTConfig } from '../config';
import { ChoreographyCritiqueSchema } from '../schemas';

export async function choreographyCriticAgent(
  input: SwarmGPTInput,
  refined: RefinedPrompt,
  plan: ChoreographyPlan,
  config: SwarmGPTConfig,
): Promise<ChoreographyCritique> {
  const system = `
You are a strict drone show reviewer.
Review the choreography for clarity, timing, creativity, feasibility and simulation safety.
Return ONLY valid JSON.
Do not rewrite the plan here.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Critique this drone choreography plan.',
      input,
      refinedPrompt: refined,
      plan,
      requiredOutput: {
        score: 'number 0-100',
        issues: [
          {
            severity: 'low | medium | high',
            category: 'timing | geometry | creativity | safety | clarity | feasibility',
            message: 'string',
            suggestedFix: 'string',
          },
        ],
        improvementBrief: 'string',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'critic', system, user });
  return ChoreographyCritiqueSchema.parse(raw);
}
