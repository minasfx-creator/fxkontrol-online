/**
 * ─── /features/command barrel ─────────────────────────────────────
 * Canonical entry for `/command` (controllers / safety consoles).
 *
 * Co-existe com `[F5 Features Re-Export]`: este barrel é o ponto único
 * para futuros consumers de `/command`. Imports legados em
 * `src/pages/CommandCenter.tsx` continuam diretos por enquanto, mas o
 * `commandSkycanvasFirewall.guard.spec.ts` proíbe que QUALQUER arquivo
 * deste lado importe da superfície `/skycanvas`.
 *
 * READ-ONLY: zero arquivo movido fisicamente.
 */
export { default as LiveFiringPanel } from '@/components/editor/LiveFiringPanel';
export { default as MA3ControlPanel } from '@/components/editor/MA3ControlPanel';
export { default as DroneCommandPanel } from '@/components/editor/DroneCommandPanel';
export { default as ShowCommanderPanel } from '@/components/editor/ShowCommanderPanel';
export { default as FXKNetPanel } from '@/components/editor/live-firing/FXKNetPanel';
export { default as DMXMonitorPanel } from '@/components/editor/dmx/DMXMonitorPanel';
export { default as QuickHardwarePanel } from '@/components/editor/QuickHardwarePanel';
export { default as ContinuityMatrix } from '@/components/editor/ContinuityMatrix';
export { default as ShowPlanInspector } from '@/components/editor/ShowPlanInspector';
export { default as SystemOverviewConsole } from '@/components/editor/SystemOverviewConsole';
export { default as SafetyConsole } from '@/components/editor/SafetyConsole';
export { default as FieldDiagnosticsConsole } from '@/components/editor/FieldDiagnosticsConsole';
export { default as FireOneExportConsole } from '@/components/editor/FireOneExportConsole';
export { default as DMXArtNetConsole } from '@/components/editor/DMXArtNetConsole';
export { default as AuditBlackBoxConsole } from '@/components/editor/AuditBlackBoxConsole';
export { default as CueValidationConsole } from '@/components/editor/CueValidationConsole';
export { default as AddressingConsole } from '@/components/editor/AddressingConsole';
export { default as ExecutionStatusConsole } from '@/components/editor/ExecutionStatusConsole';
export { default as ExportReadinessPanel } from '@/components/editor/ExportReadinessPanel';
export { default as CurrentStateMatrix } from '@/components/editor/CurrentStateMatrix';
export { default as HardwareOverview } from '@/components/editor/HardwareOverview';
export { default as RelayBankMonitor } from '@/components/editor/RelayBankMonitor';
export { default as BatteryPowerMonitor } from '@/components/editor/BatteryPowerMonitor';
export { default as MuxContinuityMonitor } from '@/components/editor/MuxContinuityMonitor';
export { default as ArtNetDMXMonitor } from '@/components/editor/ArtNetDMXMonitor';
export { default as ReadinessDashboard } from '@/components/editor/ReadinessDashboard';
export { default as SafetySummaryBar } from '@/components/editor/SafetySummaryBar';
export { default as ManualComplianceMatrix } from '@/components/editor/ManualComplianceMatrix';
export { default as UnrealIntegrationConsole } from '@/components/editor/UnrealIntegrationConsole';
export { default as SwarmContractInspector } from '@/components/editor/SwarmContractInspector';
export { default as ExecutiveReportConsole } from '@/components/editor/ExecutiveReportConsole';
export { default as FieldTestPanel } from '@/components/command/FieldTestPanel';
export { default as NoLiveHardwareEmptyState } from '@/components/command/_shared/NoLiveHardwareEmptyState';
