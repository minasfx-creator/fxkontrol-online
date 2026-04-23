// FXK-native adapters (typed against ExecutionPlan / RuntimeFrameTrace)
export { planToReplay } from "./plan-to-replay";
export { traceToReplay } from "./trace-to-replay";

// Generic shape-tolerant adapters for arbitrary planner / runtime outputs
export {
  defaultPlannerAdapter,
  mapExecutionPlanToReplayPlan,
  type PlannerAdapter,
} from "./planner-adapter";

export {
  defaultRuntimeTraceAdapter,
  mapRuntimeTraceToReplayTrace,
  type RuntimeTraceAdapter,
} from "./runtime-trace-adapter";
