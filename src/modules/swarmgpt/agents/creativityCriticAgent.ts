/**
 * SwarmGPT 3.0 — Creativity Critic Agent.
 *
 * Specialist reviewer focused exclusively on artistic merit and audience impact.
 * Does NOT check physics, timing constraints, or safety — those are handled
 * by the Safety and Tech critics respectively.
 *
 * Evaluates:
 *  • Visual memorability and surprise factor
 *  • Narrative arc: does the show tell a story with a clear arc?
 *  • Formation variety: are shapes diverse and visually interesting?
 *  • Colour / light design relative to the declared style
 *  • Emotional resonance matching the energyCurve
 *  • Transition creativity (morph vs lazy fade everywhere)
 */
import type {
  ChoreographyPlan,
  RefinedPrompt,
  SpecialistCritique,
  SwarmGPTInput,
} from '../types';
import type { SwarmGPT3Config } from '../config';
import { SpecialistCritiqueSchema } from '../schemas';

export async function creativityCriticAgent(
  input: SwarmGPTInput,
  refined: RefinedPrompt,
  plan: ChoreographyPlan,
  config: SwarmGPT3Config,
): Promise<SpecialistCritique> {
  const system = `
You are a world-class drone show artistic director and festival creative consultant.
Your ONLY job is to evaluate the ARTISTIC QUALITY of this choreography plan.

Do NOT comment on physics, timing errors, or safety distances — other reviewers
handle those. Focus exclusively on:
  • Visual memorability: will the audience remember this show?
  • Narrative coherence: does the sequence tell a compelling story?
  • Formation variety: shapes should feel handpicked, not generic
  • Colour storytelling: colours should match mood and transitions
  • Transition artistry: variety and appropriateness of transition types
  • Emotional peaks: are climaxes placed at maximum impact moments?
  • Cliché avoidance: penalise predictable or overused patterns

Score 0–100. Be demanding. A score of 80 means this is a genuinely excellent
creative plan, not merely adequate. Most plans should score 55–75.

Return ONLY valid JSON. No markdown.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Evaluate artistic quality of this choreography plan.',
      input,
      refinedPrompt: refined,
      plan,
      requiredOutput: {
        role: 'creativity',
        score: 'number 0–100',
        issues: [
          {
            severity: 'low | medium | high',
            category: 'creativity | clarity',
            message: 'string — specific artistic weakness',
            suggestedFix: 'string — concrete improvement',
          },
        ],
        summary: 'string — 2–3 sentence artistic assessment',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'creativity_critic', system, user });
  const result = SpecialistCritiqueSchema.parse(raw) as SpecialistCritique;
  // Enforce correct role tag regardless of what the LLM returned
  return { ...result, role: 'creativity' };
}
