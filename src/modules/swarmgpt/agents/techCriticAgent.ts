/**
 * SwarmGPT 3.0 — Technical Critic Agent.
 *
 * Specialist reviewer focused on technical/structural correctness of the plan.
 * Does NOT evaluate artistic quality or perform safety calculations — those are
 * handled by the Creativity and Safety critics respectively.
 *
 * Evaluates:
 *  • Timing coherence: no overlapping formations, no gaps > 2s between events
 *  • Drone count consistency: every formation has exactly droneCount points
 *  • Referential integrity: all transition fromFormationId / toFormationId exist
 *  • Transition duration feasibility: duration > 0, not impossibly short
 *  • Show coverage: formations cover the declared duration without dead zones
 *  • Beat alignment quality: if BPM is known, key formations should land on beats
 *  • Formation duration balance: no single formation consuming >40% of show time
 */
import type {
  ChoreographyPlan,
  RefinedPrompt,
  SpecialistCritique,
  SwarmGPTInput,
} from '../types';
import type { SwarmGPT3Config } from '../config';
import { SpecialistCritiqueSchema } from '../schemas';

export async function techCriticAgent(
  input: SwarmGPTInput,
  refined: RefinedPrompt,
  plan: ChoreographyPlan,
  config: SwarmGPT3Config,
): Promise<SpecialistCritique> {
  const system = `
You are a drone show software architect and show-file validator.
Your ONLY job is to find TECHNICAL / STRUCTURAL problems in this choreography plan.

Do NOT comment on artistic quality or safety distances — other reviewers handle those.
Focus exclusively on:
  • Drone count: every formation must have EXACTLY ${input.droneCount} points
  • Timing: formation.startTime + formation.duration must stay ≤ ${input.duration}s
  • No overlapping formations (two formations active at the same time slot)
  • Referential integrity of transitions (fromFormationId and toFormationId exist)
  • Transition duration > 0 and ≤ formation gap it fills
  • Dead-time: periods > 3s with no formation or transition active
  • Beat alignment: if bpm=${input.bpm ?? 'not specified'}, key events should
    land on beat boundaries (±0.2s tolerance)
  • Coverage balance: no single formation > 40% of total show duration
  • Version field must equal "swarmgpt-2.0"

Score 0–100 where 100 = no technical issues. Every missing drone point in any
formation is a critical defect and should cap the score at 30.

Return ONLY valid JSON. No markdown.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Find technical and structural problems in this choreography plan.',
      input,
      refinedPrompt: refined,
      plan,
      technicalConstraints: {
        requiredDroneCount: input.droneCount,
        maxDurationSeconds: input.duration,
        bpm: input.bpm ?? null,
        version: 'swarmgpt-2.0',
      },
      requiredOutput: {
        role: 'tech',
        score: 'number 0–100',
        issues: [
          {
            severity: 'low | medium | high',
            category: 'timing | geometry | clarity | feasibility',
            message: 'string — specific technical defect with formation/transition id',
            suggestedFix: 'string — exact fix (e.g. "add 12 points to formation f2")',
          },
        ],
        summary: 'string — 2–3 sentence technical assessment',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'tech_critic', system, user });
  const result = SpecialistCritiqueSchema.parse(raw) as SpecialistCritique;
  return { ...result, role: 'tech' };
}
