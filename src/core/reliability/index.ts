/**
 * ─── FXK Reliability Core ───────────────────────────────────────────
 * Mission-critical reliability infrastructure.
 */

export { SeededRandom, simRNG } from './seededRandom';
export { lockstep } from './lockstepEngine';
export { predictive, type PredictedEvent } from './predictiveEngine';
export { reality, type WindData, type SensorReading, type RealityCorrection } from './realityEngine';
export { emergency, type EmergencyLevel, type EmergencyState } from './emergencySystem';
export { diagnostic, feedDiagnosticFps, type DiagnosticReport, type DiagnosticCheck, type CheckStatus } from './selfDiagnostic';
export { blackbox, type BlackBoxEntry } from './blackBoxRecorder';
export { autoScaler, type QualityTier, type ScaleState } from './autoScaler';
