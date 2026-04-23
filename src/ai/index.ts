/**
 * AI module — Joi (camada externa, isolada do core determinístico).
 *
 * Joi NUNCA chama fire(), NUNCA altera runtime, NUNCA toca hardware.
 * Apenas gera ShowGraph imutável → compile → safety → HIL → cert → import.
 */
export type { ShowGraph, ShowGraphNode, ShowGraphNodeType, ShowGraphMetadata } from './showGraph';
export { createShowGraph, validateShowGraphStructure } from './showGraph';

export type { DeterministicTimeline, CompiledTimelineEvent, CompileResult } from './showCompiler';
export { compileShowGraph, verifyCompileDeterminism } from './showCompiler';

export type { SafetyCheck } from './validation/aiSafety';
export { runAISafetyChecks } from './validation/aiSafety';
