/**
 * SwarmGPT 3.0 — Devil's Advocate Agent.
 *
 * Adversarial reviewer that runs AFTER the refinement loop has converged.
 * Its job is to actively try to find failure modes that the three specialist
 * critics missed — edge cases, degenerate configurations, show-stopping risks.
 *
 * Unlike the specialist critics who score and suggest improvements, the Devil's
 * Advocate produces binary PASS/FAIL with a list of risks and mitigations.
 *
 * Typical findings:
 *  • Degenerate formations: all drones at the same point, colinear clusters
 *  • Impossible transitions: source and destination too far apart for maxDroneSpeed
 *  • Timing paradox: transition startTime < previous formation startTime
 *  • Silent failure: first formation starts > 5s — audience sees nothing at open
 *  • Runaway finale: last event ends before show duration — awkward silence
 *  • Text/logo formations with insufficient drone count for legibility
 *  • Color contradictions: colour assignments that clash with declared style
 */
import type {
  ChoreographyPlan,
  DevilsAdvocateReport,
  MultiCritiqueResult,
  SwarmGPTInput,
} from '../types';
import type { SwarmGPT3Config } from '../config';
import { DevilsAdvocateReportSchema } from '../schemas';

export async function devilsAdvocateAgent(
  input: SwarmGPTInput,
  plan: ChoreographyPlan,
  finalCritique: MultiCritiqueResult,
  config: SwarmGPT3Config,
): Promise<DevilsAdvocateReport> {
  const system = `
You are a highly sceptical drone show safety and quality auditor.
Your job is to ADVERSARIALLY review the final choreography plan.

Assume the specialists already reviewed this plan and found score=${finalCritique.aggregateScore}/100.
Your job is to find what they MISSED — edge cases, hidden failures, silent errors.

Specifically probe for:
1. Degenerate formations: are all points identical (all drones stacked)?
   Are ≥80% of points within 1m of the centroid?
2. Kinematic impossibilities: check each transition manually —
   max Euclidean distance between matched points ÷ transition.duration
   must be ≤ ${config.maxDroneSpeed} m/s. If you cannot compute exact values,
   flag suspicious cases.
3. Show-opening void: if the first formation starts after ${Math.min(5, input.duration * 0.1).toFixed(1)}s,
   the audience sees an empty sky at open — flag as high.
4. Show-end silence: if the last event ends before ${(input.duration - 3).toFixed(1)}s,
   flag as medium.
5. Text/logo feasibility: text_placeholder or logo_placeholder formations
   with fewer than 30 drones per element are illegible — flag as high.
6. Formation orphans: any formation with no incoming or outgoing transition
   (unless it's the first or last formation) — looks abrupt.
7. Colour coherence: colours that contradict the declared style
   (e.g. corporate style with neon rainbow formations).
8. Over-density: any formation with all points within a 3m radius cube
   is unsafe and geometrically meaningless.

"passed" = true only if there are NO critical or high severity findings.
Return ONLY valid JSON. No markdown.
`.trim();

  const user = JSON.stringify(
    {
      task: 'Adversarially probe this refined plan for missed failure modes.',
      input,
      plan,
      finalCritiqueScore: finalCritique.aggregateScore,
      knownIssues: finalCritique.combinedIssues.map((i) => i.message),
      safetyConstraints: {
        minDroneDistanceM: config.minDroneDistance,
        maxDroneSpeedMs: config.maxDroneSpeed,
        bounds: input.bounds,
        durationSeconds: input.duration,
      },
      requiredOutput: {
        passed: 'boolean — true only if no critical/high findings',
        findings: [
          {
            risk: 'string — specific failure mode description',
            severity: 'low | medium | high | critical',
            mitigation: 'string — exact fix or workaround',
          },
        ],
        finalVerdict:
          'string — 1–2 sentence overall judgment on production readiness',
      },
    },
    null,
    2,
  );

  const raw = await config.llm.completeJson({ role: 'devils_advocate', system, user });
  return DevilsAdvocateReportSchema.parse(raw) as DevilsAdvocateReport;
}
