/**
 * ─── JOIExecutionEngine — Central Intelligence Orchestrator ────────
 * Receives user input, classifies intent, plans tasks, runs resolvers,
 * and produces an enriched context for the AI to generate superior responses.
 */

import type { JOIExecutionTrace, JOIResolverOutput, JOIArtifact, JOIConfidenceLevel } from './joiTypes';
import type { IntegrationMode, EvidenceLevel } from '@/core/hardware/provenance';
import type { JoiMode } from './joiModes';
import { joiTaskPlanner } from './JOITaskPlanner';
import { joiResolverRegistry } from './JOIResolverRegistry';
import { joiContextBuilder } from './JoiContextBuilder';

class JOIExecutionEngineImpl {
  private lastTrace: JOIExecutionTrace | null = null;

  /** Execute the full intelligence pipeline for a user request */
  execute(input: string, currentMode: JoiMode): JOIExecutionTrace {
    const startTime = Date.now();

    // 1. Classify intent
    const intent = joiTaskPlanner.classifyIntent(input, currentMode);

    // 2. Plan tasks
    const plan = joiTaskPlanner.planTasks(intent);

    // 3. Run resolvers
    const allCategories = [intent.category, ...intent.subcategories];
    const resolverOutputs = joiResolverRegistry.runAll(input, allCategories);

    // Mark subtasks as done
    plan.subtasks.forEach(st => {
      const matchingOutput = resolverOutputs.find(o => o.resolver === st.resolver);
      if (matchingOutput) {
        st.status = 'done';
        st.output = matchingOutput.summary;
      } else {
        st.status = 'skipped';
      }
    });

    // 4. Collect all artifacts
    const allArtifacts = resolverOutputs.flatMap(o => o.artifacts);

    // 5. Derive truth metadata from resolver outputs
    const confidence = this.deriveConfidence(resolverOutputs);
    const sources = [...new Set(resolverOutputs.flatMap(o => o.source_of_truth))];
    const integrationMode = this.deriveIntegrationMode(resolverOutputs);
    const evidenceLevel = this.deriveEvidenceLevel(resolverOutputs);

    const trace: JOIExecutionTrace = {
      plan,
      resolver_outputs: resolverOutputs,
      artifacts: allArtifacts,
      total_ms: Date.now() - startTime,
      source_of_truth: sources,
      integration_mode: integrationMode,
      evidence_level: evidenceLevel,
      confidence,
    };

    this.lastTrace = trace;
    return trace;
  }

  /** Format execution trace as context for AI injection */
  formatTraceForAI(trace: JOIExecutionTrace): string {
    const parts: string[] = [
      `[JOI EXECUTION TRACE — ${trace.total_ms}ms]`,
      `Intent: ${trace.plan.intent.category} (${trace.plan.intent.subcategories.join(', ') || 'none'})`,
      `Enhanced Input: ${trace.plan.intent.enhanced_input}`,
      `Suggested Mode: ${trace.plan.intent.suggested_mode}`,
      `Confidence: ${trace.confidence} | Integration: ${trace.integration_mode} | Evidence: ${trace.evidence_level}`,
      `Sources: ${trace.source_of_truth.join(', ')}`,
      '',
      '## Resolver Outputs',
    ];

    for (const output of trace.resolver_outputs) {
      parts.push(`### ${output.resolver} [${output.confidence}] (${output.data_type})`);
      parts.push(`Sources: ${output.source_of_truth.join(', ')}`);
      parts.push(output.summary);
      if (output.detail) parts.push(output.detail);
      parts.push('');
    }

    if (trace.artifacts.length > 0) {
      parts.push('## Generated Artifacts');
      for (const art of trace.artifacts) {
        parts.push(`- ${art.title} (${art.type})`);
      }
    }

    return parts.join('\n');
  }

  /** Get the last execution trace */
  getLastTrace(): JOIExecutionTrace | null {
    return this.lastTrace;
  }

  private deriveConfidence(outputs: JOIResolverOutput[]): JOIConfidenceLevel {
    if (outputs.length === 0) return 'low';
    const levels = outputs.map(o => o.confidence);
    if (levels.includes('low')) return 'low';
    if (levels.every(l => l === 'high')) return 'high';
    return 'medium';
  }

  private deriveIntegrationMode(outputs: JOIResolverOutput[]): IntegrationMode {
    const allTypes = outputs.map(o => o.data_type);
    if (allTypes.includes('source_of_truth')) return 'simulated'; // still simulated until real hardware
    return 'simulated';
  }

  private deriveEvidenceLevel(outputs: JOIResolverOutput[]): EvidenceLevel {
    const allSources = outputs.flatMap(o => o.source_of_truth);
    if (allSources.some(s => s.includes('telemetry'))) return 'telemetry_verified';
    if (allSources.some(s => s.includes('adapter') || s.includes('Hardware'))) return 'adapter_only';
    return 'ui_only';
  }
}

export const joiExecutionEngine = new JOIExecutionEngineImpl();
