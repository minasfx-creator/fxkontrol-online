/**
 * SwarmGPT 3.0 — Safety Critic Agent.
 *
 * Specialist reviewer focused exclusively on operational safety.
 * Applies drone show industry standards (NFPA 2407, FAA UAS requirements,
 * local airspace constraints) to the choreography plan.
 *
 * Evaluates:
 *  • Minimum drone separation (minDroneDistance constraint)
 *  • Maximum speed feasibility across all transitions
 *  • Altitude bounds compliance (stays within declared airspace)
 *  • Simultaneous occupancy conflicts (two formations active at same time)
 *  • Edge-case crowd proximity (y=0 formations over ground level)
 *  • Emergency scatter space (are formations too dense to scatter safely?)
 */
import type {
  ChoreographyPlan,
  RefinedPrompt,
  SpecialistCritique,
  SwarmGPTInput,
} from '../types';
import type { SwarmGPT3Config } from '../config';
import { SpecialistCritiqueSchema } from '../schemas';

export async function safetyCriticAgent(
  input: SwarmGPTInput,
  refined: RefinedPrompt,
  plan: ChoreographyPlan,
  config: SwarmGPT3Config,
): Promise<SpecialistCritique> {
  const system = `
You are a licensed drone show safety officer and NFPA 2407 compliance expert.
Your ONLY job is to identify SAFETY RISKS in this choreography plan.

Do NOT comment on artistic quality, creativity, or general timing errors —
other reviewers handle those. Focus exclusively on:
  • Drone separation: check that all formations have points spaced
    ≥ ${config.minDroneDistance}m apart (Euclidean distance)
  • Transition speed: verify transitions do not require drones to move
    faster than ${config.maxDroneSpeed} m/s (distance ÷ transition.duration)
  • Altitude compliance: all y-coordinates must be within bounds
  • Ground proximity: y-values < 5m are a safety hazard
  • Formation density: very tight clusters risk collision in GPS-denied
    environments — flag any formation where ≥50% of points are within 3m
  • Crowd clearance: if bounds suggest audience proximity, formations
    directly over audience positions should be flagged
  • Emergency scatter: dense formations need adequate scatter headroom

Score 0–100 where 100 = zero safety concerns. Any critical safety issue
should reduce the score to ≤40. High-severity issues limit the score to ≤60.

Return ONLY valid JSON. No markdown.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Identify safety risks in this choreography plan.',
      input,
      refinedPrompt: refined,
      plan,
      safetyConstraints: {
        minDroneDistanceM: config.minDroneDistance,
        maxDroneSpeedMs: config.maxDroneSpeed,
        bounds: input.bounds,
      },
      requiredOutput: {
        role: 'safety',
        score: 'number 0–100',
        issues: [
          {
            severity: 'low | medium | high',
            category: 'safety | geometry | feasibility',
            message: 'string — specific safety concern with formation/transition id if applicable',
            suggestedFix: 'string — concrete remediation',
          },
        ],
        summary: 'string — 2–3 sentence safety assessment',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'safety_critic', system, user });
  const result = SpecialistCritiqueSchema.parse(raw) as SpecialistCritique;
  return { ...result, role: 'safety' };
}
