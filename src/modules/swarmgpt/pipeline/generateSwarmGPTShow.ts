/**
 * SwarmGPT 2.0 — Main pipeline.
 *   refiner → planner → critic → enhancer → validator → repair-loop →
 *   advanced post-processing (Poisson + beat snap + greedy matching) →
 *   final validation → compiler.
 * Never mutates runtime/timeline directly. Returns a result the caller can preview
 * or hand to `applySwarmGPTCuesToTimeline`.
 */
import type { ChoreographyPlan, SwarmGPTInput, SwarmGPTResult } from '../types';
import type { SwarmGPTConfig } from '../config';
import { promptRefinerAgent } from '../agents/promptRefinerAgent';
import { choreographyPlannerAgent } from '../agents/choreographyPlannerAgent';
import { choreographyCriticAgent } from '../agents/choreographyCriticAgent';
import { enhancementAgent } from '../agents/enhancementAgent';
import { repairAgent } from '../agents/repairAgent';
import { validateChoreographyPlan } from '../validation/validateChoreographyPlan';
import { compilePlanToTimeline } from '../compiler/compilePlanToTimeline';
import { applyAdvancedPostProcessing } from './postProcess';

export async function generateSwarmGPTShow(
  input: SwarmGPTInput,
  config: SwarmGPTConfig,
): Promise<SwarmGPTResult> {
  try {
    const refinedPrompt = await promptRefinerAgent(input, config);
    const initialPlan = await choreographyPlannerAgent(input, refinedPrompt, config);
    const critique = await choreographyCriticAgent(input, refinedPrompt, initialPlan, config);

    let plan: ChoreographyPlan = await enhancementAgent(
      input,
      refinedPrompt,
      initialPlan,
      critique,
      config,
    );

    let validation = validateChoreographyPlan(plan, input, config);
    let attempts = 0;
    while (!validation.ok && attempts < config.maxRepairAttempts) {
      plan = await repairAgent(input, plan, validation, config);
      validation = validateChoreographyPlan(plan, input, config);
      attempts++;
    }

    if (!validation.ok) {
      return {
        ok: false,
        refinedPrompt,
        plan,
        critique,
        validation,
        error: 'SwarmGPT could not produce a valid choreography plan.',
      };
    }

    // Deterministic post-processing (Poisson → beat snap → matching → sort).
    plan = applyAdvancedPostProcessing(plan, input, config);

    const finalValidation = validateChoreographyPlan(plan, input, config);
    if (!finalValidation.ok) {
      return {
        ok: false,
        refinedPrompt,
        plan,
        critique,
        validation: finalValidation,
        error: 'Advanced post-processing produced invalid plan.',
      };
    }

    const timelineCues = compilePlanToTimeline(plan);
    return { ok: true, refinedPrompt, plan, critique, validation: finalValidation, timelineCues };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown SwarmGPT pipeline error.',
    };
  }
}
