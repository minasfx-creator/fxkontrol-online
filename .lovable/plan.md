

# Phase 5: Executive Consolidation — Plan

## What Already Exists (no changes needed)

These consoles are fully implemented in CommandCenter:
- **System Overview** (`SystemOverviewConsole`)
- **Verification Console** (`VerificationBar` + `ShowPlanInspector`)
- **Readiness Dashboard** (`ReadinessDashboard`)
- **Hardware Overview** (`HardwareOverview`)
- **Audit / BlackBox** (`AuditBlackBoxConsole`)
- **Current State Matrix** (`CurrentStateMatrix` — 16 rows, 5 columns)
- **Export Readiness** (`ExportReadinessPanel`)
- **FireOne Export** (`FireOneExportConsole`)

## What Needs to Be Built (4 new components + 1 expansion)

### 1. Manual Compliance Matrix (NEW)
A new console mapping manual requirements to implementation status.

Rows: NFPA 1123/1126, Showven Manual, Finale 3D, FireOne Protocol, Art-Net Spec, VDL Standard, ESP32 Datasheet, SMPTE Timecode.

Columns: Requirement Source, Section/Clause, Implementation Status (implemented/partial/planned/not_applicable), Evidence (code path or test), Action Required.

Populated with static data reflecting actual codebase coverage. ~180 lines.

### 2. Unreal Integration Status Console (NEW)
Dedicated console showing:
- UnrealBridge connection state (currently `not_integrated`)
- WebSocket/UDP link health
- Last sync timestamp
- Exported variables vs BP_SwarmManager contract
- Data flow direction indicator (FXK → Unreal)

~120 lines.

### 3. BP_SwarmManager Contract Inspector (NEW)
Shows the contract definition (variables, functions, events) from the existing `unrealSwarmContract.ts` and cross-references against ShowPlan drone paths. Displays:
- Required variables with expected/actual values
- Required functions with implementation status
- Required events with binding status
- Contract compliance score

~150 lines.

### 4. Executive Status Report Generator (NEW)
Auto-generates a system status report combining:
- Current State Matrix summary
- Verification Pass results
- Readiness level
- Hardware health scores
- Open issues count by severity
- Export readiness per channel
- Timestamp and operator info

Renders as a printable/exportable view. Download as JSON. ~200 lines.

### 5. Current State Matrix — Drill-Down Expansion
Add click handlers to each row that navigate to the corresponding console in CommandCenter. Add a summary header showing counts by status (X exists, Y partial, Z placeholder, W absent).

~30 lines of changes.

## Integration into CommandCenter

Add new `CommandMode` entries:
- `manual_compliance` → Manual Compliance Matrix
- `unreal_status` → Unreal Integration Status
- `swarm_contract` → BP_SwarmManager Contract Inspector
- `exec_report` → Executive Status Report

Add to MONITORING section in sidebar. Add accent configs.

## Files to Create
1. `src/components/editor/ManualComplianceMatrix.tsx`
2. `src/components/editor/UnrealIntegrationConsole.tsx`
3. `src/components/editor/SwarmContractInspector.tsx`
4. `src/components/editor/ExecutiveReportConsole.tsx`

## Files to Modify
1. `src/pages/CommandCenter.tsx` — add 4 new modes, lazy imports, sidebar entries, render cases
2. `src/components/editor/CurrentStateMatrix.tsx` — add drill-down navigation and summary header

## Design
All new consoles follow the existing command-grade aesthetic: dark background, mono fonts, colored status badges, industrial layout with scroll areas.

