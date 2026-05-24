/**
 * SwarmGPT 3.0 — Multi-Agent Refinement Pipeline.
 *
 * Phases:
 *   0  Prompt Expansion   — N creative variants → selector picks the best
 *   1  Parallel Planning  — N candidate plans generated concurrently
 *   2  Parallel Critique  — 3 specialist critics per candidate (concurrent)
 *                           → winner selected by aggregate score
 *   3  Refinement Loop    — critic→enhance cycles until score ≥ threshold
 *                           or max passes reached or score stalls
 *   4  Devil's Advocate   — adversarial review; one extra enhance pass if critical
 *   5  Validation/Repair  — deterministic schema+geometry+timing validation
 *   6  Post-process       — Poisson resample, beat snap, greedy matching, sort
 *   7  Compile            — ChoreographyPlan → TimelineCue[]
 *
 * Never mutates runtime state. Returns SwarmGPTResult3 — the caller previews
 * or applies via `applySwarmGPTCuesToTimeline`.
 *
 * Progress events are emitted via the optional `onProgress` callback so the
 * UI can render a live refinement log.
 */
import type {
  ChoreographyPlan,
  MultiCritiqueResult,
  PipelineProgressCallback,
  PlanCandidate,
  RefinementIteration,
  SwarmGPTInput,
  SwarmGPTResult3,
} from '../types';
import type { SwarmGPT3Config } from '../config';

import { promptExpansionAgent } from '../agents/promptExpansionAgent';
import { promptSelectorAgent } from '../agents/promptSelectorAgent';
import { choreographyPlannerAgent } from '../agents/choreographyPlannerAgent';
import { creativityCriticAgent } from '../agents/creativityCriticAgent';
import { safetyCriticAgent } from '../agents/safetyCriticAgent';
import { techCriticAgent } from '../agents/techCriticAgent';
import { aggregateCriticAgent } from '../agents/aggregateCriticAgent';
import { enhancementAgent } from '../agents/enhancementAgent';
import { devilsAdvocateAgent } from '../agents/devilsAdvocateAgent';
import { repairAgent } from '../agents/repairAgent';
import { validateChoreographyPlan } from '../validation/validateChoreographyPlan';
import { compilePlanToTimeline } from '../compiler/compilePlanToTimeline';
import { applyAdvancedPostProcessing } from './postProcess';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Emit a progress event if a callback is registered. */
function emit(
  onProgress: PipelineProgressCallback | undefined,
  phase: Parameters<PipelineProgressCallback>[0]['phase'],
  message: string,
  progress: number,
  data?: unknown,
): void {
  onProgress?.({ phase, message, progress, data });
}

/**
 * Run all three specialist critics for a single plan concurrently.
 * Returns an aggregate MultiCritiqueResult.
 */
async function runSpecialistCritique(
  input: SwarmGPTInput,
  plan: ChoreographyPlan,
  refined: Parameters<typeof choreographyPlannerAgent>[1],
  config: SwarmGPT3Config,
): Promise<MultiCritiqueResult> {
  const [creativity, safety, tech] = await Promise.all([
    creativityCriticAgent(input, refined, plan, config),
    safetyCriticAgent(input, refined, plan, config),
    techCriticAgent(input, refined, plan, config),
  ]);
  return aggregateCriticAgent(input, plan, [creativity, safety, tech], config);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main pipeline
// ─────────────────────────────────────────────────────────────────────────────

export async function generateSwarmGPTShowV3(
  input: SwarmGPTInput,
  config: SwarmGPT3Config,
  onProgress?: PipelineProgressCallback,
): Promise<SwarmGPTResult3> {
  try {
    // ── Phase 0: Prompt Expansion ─────────────────────────────────────────
    emit(onProgress, 'prompt_expansion', 'Exploring creative directions…', 0.02);

    const expansion = await promptExpansionAgent(input, config);

    emit(
      onProgress,
      'prompt_expansion',
      `Generated ${expansion.variants.length} creative directions. Selecting best…`,
      0.06,
      { variants: expansion.variants.map((v) => v.direction) },
    );

    const { selectedVariantId, refinedPrompt } = await promptSelectorAgent(
      input,
      expansion,
      config,
    );
    const finalExpansion = { ...expansion, selectedVariantId };

    emit(
      onProgress,
      'prompt_expansion',
      `Selected direction: "${expansion.variants.find((v) => v.id === selectedVariantId)?.direction ?? selectedVariantId}"`,
      0.10,
      { selectedVariantId, refinedPrompt },
    );

    // ── Phase 1: Parallel Planning ────────────────────────────────────────
    emit(
      onProgress,
      'parallel_planning',
      `Generating ${config.parallelCandidates} candidate plans in parallel…`,
      0.12,
    );

    const candidatePlans = await Promise.all(
      Array.from({ length: config.parallelCandidates }, (_, idx) =>
        choreographyPlannerAgent(input, refinedPrompt, config).then(
          (plan): PlanCandidate => ({
            id: `candidate_${idx + 1}`,
            plan,
            variantId: selectedVariantId,
          }),
        ),
      ),
    );

    emit(
      onProgress,
      'parallel_planning',
      `${candidatePlans.length} candidates ready. Running specialist critique…`,
      0.22,
    );

    // ── Phase 2: Multi-Critic Review — select winner ──────────────────────
    const candidateCritiques = await Promise.all(
      candidatePlans.map((c) =>
        runSpecialistCritique(input, c.plan, refinedPrompt, config),
      ),
    );

    // Select candidate with highest aggregate score
    let bestIdx = 0;
    let bestScore = -1;
    for (let i = 0; i < candidateCritiques.length; i++) {
      if (candidateCritiques[i].aggregateScore > bestScore) {
        bestScore = candidateCritiques[i].aggregateScore;
        bestIdx = i;
      }
    }

    const selectedCandidate = candidatePlans[bestIdx];
    let currentPlan = selectedCandidate.plan;
    let currentCritique = candidateCritiques[bestIdx];

    emit(
      onProgress,
      'candidate_selection',
      `Selected candidate ${selectedCandidate.id} (score ${currentCritique.aggregateScore}/100). Starting refinement loop…`,
      0.38,
      {
        selectedCandidateId: selectedCandidate.id,
        scores: candidateCritiques.map((c, i) => ({
          id: candidatePlans[i].id,
          score: c.aggregateScore,
        })),
      },
    );

    // ── Phase 3: Refinement Loop ──────────────────────────────────────────
    const refinementIterations: RefinementIteration[] = [];
    const REFINEMENT_PROGRESS_START = 0.38;
    const REFINEMENT_PROGRESS_END = 0.70;

    for (let pass = 1; pass <= config.maxRefinementPasses; pass++) {
      if (currentCritique.aggregateScore >= config.minQualityScore) {
        emit(
          onProgress,
          'refinement_loop',
          `Quality threshold reached (${currentCritique.aggregateScore} ≥ ${config.minQualityScore}). Exiting refinement loop.`,
          REFINEMENT_PROGRESS_END,
        );
        break;
      }

      const passProgress =
        REFINEMENT_PROGRESS_START +
        ((pass - 1) / config.maxRefinementPasses) *
          (REFINEMENT_PROGRESS_END - REFINEMENT_PROGRESS_START);

      emit(
        onProgress,
        'refinement_loop',
        `Refinement pass ${pass}/${config.maxRefinementPasses} — score ${currentCritique.aggregateScore}/100. Enhancing…`,
        passProgress,
        { pass, scoreBefore: currentCritique.aggregateScore, issues: currentCritique.combinedIssues.length },
      );

      // Build a ChoreographyCritique-compatible object for the existing enhancementAgent
      const legacyCritique = {
        score: currentCritique.aggregateScore,
        issues: currentCritique.combinedIssues,
        improvementBrief: currentCritique.improvementBrief,
      };

      const enhancedPlan = await enhancementAgent(
        input,
        refinedPrompt,
        currentPlan,
        legacyCritique,
        config,
      );

      // Re-run all three critics on the enhanced plan
      const newCritique = await runSpecialistCritique(
        input,
        enhancedPlan,
        refinedPrompt,
        config,
      );

      const scoreImprovement = newCritique.aggregateScore - currentCritique.aggregateScore;

      refinementIterations.push({
        pass,
        scoreBefore: currentCritique.aggregateScore,
        scoreAfter: newCritique.aggregateScore,
        multiCritique: newCritique,
      });

      emit(
        onProgress,
        'refinement_loop',
        `Pass ${pass} complete — score ${currentCritique.aggregateScore} → ${newCritique.aggregateScore} (${scoreImprovement >= 0 ? '+' : ''}${scoreImprovement})`,
        passProgress + (REFINEMENT_PROGRESS_END - REFINEMENT_PROGRESS_START) / config.maxRefinementPasses,
        { pass, scoreBefore: currentCritique.aggregateScore, scoreAfter: newCritique.aggregateScore },
      );

      currentPlan = enhancedPlan;
      currentCritique = newCritique;

      // Early exit if score is stalling (< 2 point improvement)
      if (scoreImprovement < 2 && pass > 1) {
        emit(
          onProgress,
          'refinement_loop',
          `Score stalled (improvement ${scoreImprovement}pt). Accepting current result.`,
          REFINEMENT_PROGRESS_END,
        );
        break;
      }
    }

    // ── Phase 4: Devil's Advocate ─────────────────────────────────────────
    let devilsAdvocate = undefined;

    if (config.enableAdversarialReview) {
      emit(
        onProgress,
        'adversarial_review',
        'Running Devil\'s Advocate adversarial review…',
        0.72,
      );

      devilsAdvocate = await devilsAdvocateAgent(
        input,
        currentPlan,
        currentCritique,
        config,
      );

      const criticalFindings = devilsAdvocate.findings.filter(
        (f) => f.severity === 'critical' || f.severity === 'high',
      );

      emit(
        onProgress,
        'adversarial_review',
        devilsAdvocate.passed
          ? `Devil's Advocate: PASS — ${devilsAdvocate.findings.length} minor findings.`
          : `Devil's Advocate: FLAGGED — ${criticalFindings.length} critical/high risks. Applying emergency enhancement…`,
        0.76,
        { passed: devilsAdvocate.passed, findings: criticalFindings.length },
      );

      // If the Devil's Advocate failed, do one emergency enhancement pass
      if (!devilsAdvocate.passed && criticalFindings.length > 0) {
        const emergencyCritique = {
          score: Math.min(currentCritique.aggregateScore, 40),
          issues: criticalFindings.map((f) => ({
            severity: (f.severity === 'critical' ? 'high' : f.severity) as 'low' | 'medium' | 'high',
            category: 'safety' as const,
            message: f.risk,
            suggestedFix: f.mitigation,
          })),
          improvementBrief: `CRITICAL: ${criticalFindings.map((f) => f.risk).join('; ')}. Fix these before production.`,
        };

        currentPlan = await enhancementAgent(
          input,
          refinedPrompt,
          currentPlan,
          emergencyCritique,
          config,
        );

        emit(
          onProgress,
          'adversarial_review',
          'Emergency enhancement applied. Proceeding to validation.',
          0.80,
        );
      }
    }

    // ── Phase 5: Validation + Repair ──────────────────────────────────────
    emit(onProgress, 'validation', 'Running deterministic validation…', 0.82);

    let validation = validateChoreographyPlan(currentPlan, input, config);
    let repairAttempts = 0;

    while (!validation.ok && repairAttempts < config.maxRepairAttempts) {
      repairAttempts++;
      emit(
        onProgress,
        'validation',
        `Validation found ${validation.issues.filter((i) => i.severity === 'error').length} error(s). Running repair attempt ${repairAttempts}…`,
        0.82 + repairAttempts * 0.02,
      );
      currentPlan = await repairAgent(input, currentPlan, validation, config);
      validation = validateChoreographyPlan(currentPlan, input, config);
    }

    if (!validation.ok) {
      emit(onProgress, 'failed', 'Pipeline failed: could not produce a valid plan after repair.', 1.0);
      return {
        ok: false,
        expansion: finalExpansion,
        refinedPrompt,
        candidates: candidatePlans,
        selectedCandidateId: selectedCandidate.id,
        refinementIterations,
        finalCritique: currentCritique,
        devilsAdvocate,
        plan: currentPlan,
        validation,
        totalPasses: refinementIterations.length,
        finalScore: currentCritique.aggregateScore,
        error: 'SwarmGPT 3.0 could not produce a valid choreography plan after repair.',
      };
    }

    // ── Phase 6: Post-processing ──────────────────────────────────────────
    emit(onProgress, 'post_processing', 'Applying post-processing (Poisson, beat-snap, matching)…', 0.90);

    const processedPlan = applyAdvancedPostProcessing(currentPlan, input, config);

    const finalValidation = validateChoreographyPlan(processedPlan, input, config);
    if (!finalValidation.ok) {
      emit(onProgress, 'failed', 'Post-processing produced invalid plan.', 1.0);
      return {
        ok: false,
        expansion: finalExpansion,
        refinedPrompt,
        candidates: candidatePlans,
        selectedCandidateId: selectedCandidate.id,
        refinementIterations,
        finalCritique: currentCritique,
        devilsAdvocate,
        plan: processedPlan,
        validation: finalValidation,
        totalPasses: refinementIterations.length,
        finalScore: currentCritique.aggregateScore,
        error: 'Post-processing produced an invalid plan.',
      };
    }

    // ── Phase 7: Compilation ──────────────────────────────────────────────
    emit(onProgress, 'compilation', 'Compiling to timeline cues…', 0.96);

    const timelineCues = compilePlanToTimeline(processedPlan);

    emit(
      onProgress,
      'complete',
      `Pipeline complete. Final score: ${currentCritique.aggregateScore}/100. ${timelineCues.length} timeline cues generated.`,
      1.0,
      { finalScore: currentCritique.aggregateScore, cueCount: timelineCues.length },
    );

    return {
      ok: true,
      expansion: finalExpansion,
      refinedPrompt,
      candidates: candidatePlans,
      selectedCandidateId: selectedCandidate.id,
      refinementIterations,
      finalCritique: currentCritique,
      devilsAdvocate,
      plan: processedPlan,
      validation: finalValidation,
      timelineCues,
      totalPasses: refinementIterations.length,
      finalScore: currentCritique.aggregateScore,
    };
  } catch (error) {
    emit(onProgress, 'failed', `Pipeline error: ${error instanceof Error ? error.message : String(error)}`, 1.0);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown SwarmGPT 3.0 pipeline error.',
    };
  }
}
