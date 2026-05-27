/**
 * SwarmGPT 3.0 — Aggregate Critic Agent.
 *
 * Synthesises the outputs of the three specialist critics
 * (creativity, safety, tech) into a single MultiCritiqueResult that:
 *   1. Computes the weighted aggregate score.
 *   2. Deduplicates and severity-escalates the combined issue list.
 *      (If ≥2 specialists flag the same problem, it is escalated one level.)
 *   3. Produces a unified improvement brief for the Enhancement Agent.
 *
 * This is intentionally lightweight — mostly deterministic synthesis
 * with a small LLM pass to write the improvement brief and deduplicate
 * semantically similar issues that differ in wording.
 */
import type {
  ChoreographyPlan,
  ChoreographyCritiqueIssue,
  MultiCritiqueResult,
  SpecialistCritique,
  SwarmGPTInput,
} from '../types';
import type { SwarmGPT3Config } from '../config';
import { MultiCritiqueResultSchema } from '../schemas';

/**
 * Compute the weighted aggregate score from specialist scores.
 * weights = [creativity, safety, tech], must sum to 1.0.
 */
function computeAggregateScore(
  specialists: SpecialistCritique[],
  weights: [number, number, number],
): number {
  const roleOrder: Array<SpecialistCritique['role']> = ['creativity', 'safety', 'tech'];
  let weightedSum = 0;
  let totalWeight = 0;

  for (let i = 0; i < roleOrder.length; i++) {
    const sp = specialists.find((s) => s.role === roleOrder[i]);
    if (!sp) continue;
    weightedSum += sp.score * weights[i];
    totalWeight += weights[i];
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export async function aggregateCriticAgent(
  input: SwarmGPTInput,
  plan: ChoreographyPlan,
  specialists: SpecialistCritique[],
  config: SwarmGPT3Config,
): Promise<MultiCritiqueResult> {
  const aggregateScore = computeAggregateScore(specialists, config.criticWeights);

  const system = `
You are a drone show quality assurance lead. You receive the individual reports
from three specialist critics and must produce a unified critique report.

Your tasks:
1. Review all issues from all critics.
2. Identify semantically duplicate issues (same root cause, different wording)
   and merge them into one entry. If ≥2 critics flagged the same issue,
   escalate its severity by one level (low→medium, medium→high).
3. Write a clear, actionable "improvementBrief" — a prioritised list of the
   most impactful changes the Enhancement Agent should make. Start with the
   highest-severity issues. Be specific: name formations/transitions by id.
4. The aggregateScore is ALREADY COMPUTED — use exactly: ${aggregateScore}.
   Do not recalculate it.

Return ONLY valid JSON. No markdown.
`.trim();

  const allIssues: ChoreographyCritiqueIssue[] = specialists.flatMap((s) => s.issues);

  const user = JSON.stringify(
    {
      task: 'Synthesise specialist critiques into a unified improvement report.',
      input,
      plan,
      specialists,
      preComputedAggregateScore: aggregateScore,
      criticWeights: {
        creativity: config.criticWeights[0],
        safety: config.criticWeights[1],
        tech: config.criticWeights[2],
      },
      allIssuesForDedup: allIssues,
      requiredOutput: {
        specialists: '— copy unchanged from input',
        aggregateScore: aggregateScore,
        combinedIssues: [
          {
            severity: 'low | medium | high (escalate if ≥2 critics agree)',
            category: 'timing | geometry | creativity | safety | clarity | feasibility',
            message: 'string',
            suggestedFix: 'string',
          },
        ],
        improvementBrief:
          'string — ordered prioritised list of improvements for the Enhancement Agent',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'aggregate_critic', system, user });
  const parsed = MultiCritiqueResultSchema.parse(raw) as MultiCritiqueResult;

  // Hard-override the aggregate score with the deterministic computation
  // to prevent LLM from hallucinating a different number
  return {
    ...parsed,
    specialists,
    aggregateScore,
  };
}
