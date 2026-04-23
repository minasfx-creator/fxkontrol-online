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

// ─── Schema V2 (multi-layer: drone + dmx + pyro) ───────────────────
export type {
  JoiShowGraphV2,
  JoiMetadataV2,
  JoiStage,
  JoiLayer,
  JoiDroneLayer,
  JoiDroneMove,
  JoiDMXLayer,
  JoiDMXCue,
  JoiFixture,
  JoiPyroLayer,
  JoiPyroDevice,
  JoiPyroEvent,
  JoiConstraints,
  JoiSafetyZone,
  JoiValidationResult,
} from './showGraphV2';
export { createShowGraphV2, validateShowGraphV2 } from './showGraphV2';

// ─── LLM adapter (Sprint LLM-1/2) ──────────────────────────────────
export type { JoiLLMResponse } from './joiLLMAdapter';
export { generateJoiGraph } from './joiLLMAdapter';

// ─── Compiler v2 (AST → IR, isolado do core) ───────────────────────
export type {
  JoiAST,
  JoiASTNode,
  JoiNodeKind,
  JoiTarget,
  JoiIR,
  IRStep,
  IRCommand,
  IRAction,
  CompileResultV2,
} from './joiCompilerV2';
export { compileJoiV2 } from './joiCompilerV2';

// ─── Execution Planner v1 (IR → frame schedule) ────────────────────
export type {
  ExecutionPlan,
  ExecutionFrame,
  PlannedCommand,
} from './joiExecutionPlanner';
export { buildExecutionPlan } from './joiExecutionPlanner';

// ─── Execution Runtime v1 (frame scheduler + deterministic dispatch) ─
export type {
  RuntimeConfig,
  RuntimeFrameTrace,
  RuntimeStats,
  CommandAdapter,
  AbortReason,
} from './joiExecutionRuntime';
export { ExecutionRuntimeV1, RuntimeClock } from './joiExecutionRuntime';

// ─── Replay Engine v1 (deterministic plan ↔ trace verifier) ────────
export type {
  ReplayIntegrity,
  DivergenceType,
  DivergenceSeverity,
  ReplayDivergence,
  ReplayTimingStats,
  ReplayReport,
  ObservedEvent,
  ObservedFrame,
  RuntimeTrace,
  ReplayOptions,
} from './replay';
export { eventSignature, replayExecution } from './replay';
