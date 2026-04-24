/**
 * SwarmGPT 2.0 — Agent 2/4: Choreography Planner.
 * Produces the initial plan from the refined brief.
 */
import type { ChoreographyPlan, RefinedPrompt, SwarmGPTInput } from '../types';
import type { SwarmGPTConfig } from '../config';
import { ChoreographyPlanSchema } from '../schemas';

export async function choreographyPlannerAgent(
  input: SwarmGPTInput,
  refined: RefinedPrompt,
  config: SwarmGPTConfig,
): Promise<ChoreographyPlan> {
  const system = `
You are a drone choreography planning model.
Create a feasible drone show plan.
Return ONLY valid JSON.
Every formation must contain exactly droneCount points.
All times must fit inside duration.
Do not output executable flight instructions for real hardware.
This is for simulation and creative planning only.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Create initial drone choreography plan.',
      droneCount: input.droneCount,
      duration: input.duration,
      bounds: input.bounds,
      refinedPrompt: refined,
      requiredOutput: {
        version: 'swarmgpt-2.0',
        title: 'string',
        duration: input.duration,
        droneCount: input.droneCount,
        formations: [
          {
            id: 'string',
            name: 'string',
            shape:
              'circle | sphere | heart | logo_placeholder | text_placeholder | wave | spiral | grid | line | custom',
            startTime: 'number',
            duration: 'number',
            points: [{ x: 'number', y: 'number', z: 'number' }],
            color: 'optional string',
            description: 'optional string',
          },
        ],
        transitions: [
          {
            id: 'string',
            fromFormationId: 'string',
            toFormationId: 'string',
            type: 'morph | fade | wave | spiral | explode | gather',
            startTime: 'number',
            duration: 'number',
          },
        ],
        notes: ['string'],
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'planner', system, user });
  return ChoreographyPlanSchema.parse(raw);
}
