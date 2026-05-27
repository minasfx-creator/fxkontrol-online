/**
 * SwarmGPT 2.0 — Repair Agent.
 * Fixes deterministic validation errors only. Preserves creative intent.
 */
import type { ChoreographyPlan, SwarmGPTInput, ValidationReport } from '../types';
import type { SwarmGPTConfig } from '../config';
import { ChoreographyPlanSchema } from '../schemas';

export async function repairAgent(
  input: SwarmGPTInput,
  plan: ChoreographyPlan,
  validation: ValidationReport,
  config: SwarmGPTConfig,
): Promise<ChoreographyPlan> {
  const system = `
You are a drone choreography repair model.
Fix only validation issues.
Return ONLY valid JSON matching the choreography plan schema.
Keep exactly droneCount points per formation.
Keep all points inside bounds.
Keep all times inside duration.
Maintain the same creative idea as much as possible.
Do not output executable flight instructions for real hardware.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Repair this choreography plan.',
      input,
      invalidPlan: plan,
      validationIssues: validation.issues,
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'repair', system, user });
  return ChoreographyPlanSchema.parse(raw) as ChoreographyPlan;
}
