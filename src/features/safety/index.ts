/**
 * FXKONTROL Feature Re-Export Barrel
 *
 * READ-ONLY barrel: re-exports components from src/components/editor/
 * to enable the canonical feature-oriented import path:
 *
 *   import { SafetyConsole } from '@/features/safety';
 *
 * Physical files have NOT moved yet — this is Phase F5.A.
 * Phase F5.B will physically migrate files and remove the alias.
 *
 * This file is generated. Do not hand-edit.
 */

export * from '@/components/editor/AuditBlackBoxConsole';
export * from '@/components/editor/ContinuityMatrix';
export * from '@/components/editor/ManualComplianceMatrix';
export * from '@/components/editor/MuxContinuityMonitor';
export * from '@/components/editor/SafetyConsole';
export * from '@/components/editor/SafetyPanel';
export * from '@/components/editor/SafetySummaryBar';
export * from '@/components/editor/VerificationBar';
