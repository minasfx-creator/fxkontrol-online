/**
 * Safety subsystem barrel export.
 * NOTE: For mission-critical paths (EngineProvider), prefer direct imports.
 */
export { safetyStateMachine, type SafetyState, type SafetyTransition, type InterlockConditions } from './SafetyStateMachine';
export { safetyValidator, type ValidationResult } from './SafetyValidator';
export { safetyAuditTrail, type AuditEntry } from './SafetyAuditTrail';
export { continuityCheckService, type PinStatus, type PinResult, type ContinuityReport } from './ContinuityCheckService';
