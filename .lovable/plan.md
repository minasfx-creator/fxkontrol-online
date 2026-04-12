

# FX KONTROL — Hardware Integration Consolidation Plan

## Current State Assessment

The system is approximately **80% complete**. After thorough codebase analysis, here is the exact status:

### Already Exists (no changes needed)
- **All 7 hardware adapters**: Arduino, 74HC595, CD4051, RelayBank32, Battery, ArtNet, FireOne
- **Core types.ts**: All required interfaces (HardwareDevice, HardwareStatusSnapshot, BatteryState, MultiplexerState, ShiftRegisterState, RelayBankState, ContinuityState, LinkHealthState, ReadinessResult, ExportProfile)
- **UnifiedHardwareRegistry**: Adapter registration, polling, snapshots, health aggregation
- **ReadinessEvaluator**: Status levels (BLOCKED, READY_FOR_SIMULATION, READY_FOR_EXPORT, READY_FOR_HARDWARE_SYNC), allowed operations
- **VerificationEngine**: 30+ checks across 8 categories (metadata, integrity, pyro, dmx, drone, timing, safety, hardware)
- **Verification types**: VerificationStatus, VerificationIssue, VerificationResult
- **DeviceEventLog**: Event logging + health timeline
- **BlackBoxRecorder**: Aviation-grade circular buffer recorder
- **SafetyStateMachine + SafetyAuditTrail**: Interlock lifecycle
- **ManualModeState**: Key switch + deadman modeling
- **Test data loader**: 4 scenarios (healthy, degraded, critical, mixed)
- **All UI monitors**: HardwareOverview, RelayBankMonitor, BatteryPowerMonitor, MuxContinuityMonitor, ArtNetDMXMonitor, ReadinessDashboard, CurrentStateMatrix, ExportReadinessPanel, SystemOverviewConsole

### Missing — To Be Created

| Module | Purpose |
|--------|---------|
| **DMXUniverseAdapter** | Dedicated adapter for DMX universe state monitoring |
| **TelemetryPoller** | Centralized polling orchestrator with adaptive frequency |
| **HardwareHealthMonitor** | Aggregated health scoring with threshold alerts |
| **DeviceDiscovery** | Simulated device discovery/enumeration service |
| **ExportCoordinator** | Unified export pipeline gate (ShowPlan → Verify → Export) |
| **OperationalModeGuard** | Enforces mode restrictions, blocks prohibited operations |
| **VerificationLog** | Persistent verification run history |

---

## Phase 1 — Missing Core Modules (5 files)

### 1.1 DMXUniverseAdapter (`src/core/hardware/adapters/DMXUniverseAdapter.ts`)
- Implements `HardwareAdapter<DMXUniverseState>`
- Tracks universe mapping, channel occupancy, refresh rate
- Read-only: monitors DMX output state without sending data

### 1.2 TelemetryPoller (`src/core/hardware/TelemetryPoller.ts`)
- Wraps `UnifiedHardwareRegistry.pollAll()` with adaptive frequency
- 500ms during active diagnostics, 5s backoff when healthy
- Records health snapshots to DeviceEventLog on each poll cycle

### 1.3 HardwareHealthMonitor (`src/core/hardware/HardwareHealthMonitor.ts`)
- Subscribes to registry changes
- Computes weighted health score: safety (40%), hardware (30%), network (30%)
- Emits threshold alerts when score drops below configurable levels
- Logs state transitions to BlackBoxRecorder

### 1.4 DeviceDiscovery (`src/core/hardware/DeviceDiscovery.ts`)
- Simulated enumeration of available hardware adapters
- Provides discovery status per device type
- Used by HardwareOverview UI to show "Scanning..." states

### 1.5 ExportCoordinator (`src/core/export/ExportCoordinator.ts`)
- Single entry point for all exports: enforces `ShowPlan → VerificationPass → ReadinessEvaluator → Exporter`
- Gates FireOne, ArtNet, Drone exports behind ReadinessEvaluator
- Logs every export attempt to SafetyAuditTrail
- Returns structured result with success/failure and issues

---

## Phase 2 — Mode Enforcement & Guards (2 files)

### 2.1 OperationalModeGuard (`src/core/hardware/OperationalModeGuard.ts`)
- Enforces the 6 operational modes: preview, diagnostics, dry-run, read-only-sync, export, blocked
- Maps each mode to allowed operations
- Provides `assertAllowed(operation)` that throws if prohibited
- Consumed by ExportCoordinator and any future command path

### 2.2 VerificationLog (`src/core/verification/VerificationLog.ts`)
- Stores history of verification runs (timestamp, level, pass/fail counts)
- Queryable by time range
- Used by Audit/BlackBox console for traceability

---

## Phase 3 — UI Consolidation (3 files updated)

### 3.1 Update ExportReadinessPanel
- Wire through ExportCoordinator instead of calling exporters directly
- Show OperationalMode badge
- Display blocked operations with reasons

### 3.2 Update HardwareOverview
- Add DeviceDiscovery "scan" button
- Show TelemetryPoller status (polling frequency indicator)
- Display HardwareHealthMonitor weighted score

### 3.3 Update CurrentStateMatrix
- Add DMXUniverseAdapter row (row 15)
- Add ExportCoordinator status row
- Reflect real adapter connection states dynamically

---

## Phase 4 — Mermaid Architecture Diagram

Generate updated `FXK_Hardware_Architecture_v6.mmd` showing:

```text
UI Layer
  |
  v
ShowPlan --> VerificationEngine --> ReadinessEvaluator --> ExportCoordinator
                                        |                      |
                                  OperationalModeGuard    [FireOne, ArtNet, Drone]
                                        |
                              UnifiedHardwareRegistry
                                   /    |    \
                        Adapters: Nano, 595, CD4051, Relay, Battery, ArtNet, DMX, FireOne
                                        |
                              TelemetryPoller (adaptive)
                                        |
                              HardwareHealthMonitor --> DeviceEventLog --> BlackBox
```

---

## Integration Status — Honest Assessment

| Subsystem | Status | Notes |
|-----------|--------|-------|
| ShowPlan | **Real** | Source of truth, with test data seeding |
| VerificationPass | **Real** | 30+ checks, gates exports |
| HardwareRegistry | **Real** | 7 adapters, polling, snapshots |
| Arduino Adapter | **Simulated** | State model matches real Nano, no serial link |
| 74HC595 Adapter | **Simulated** | SPI state model, no physical bus |
| CD4051 Adapter | **Simulated** | 16-ch analog model, no ADC link |
| Relay Bank | **Simulated** | 32-ch continuity model |
| Battery Monitor | **Simulated** | Voltage/discharge model |
| Art-Net Monitor | **Simulated** | Link health model, no network socket |
| DMX Universe | **To build** | Universe state model |
| FireOne Export | **Real** | Generates .fir from validated ShowPlan |
| ArtNet Export | **Real** | Generates CSV from validated ShowPlan |
| Drone Export | **Real** | Generates CSV from validated ShowPlan |
| AuditTrail | **Real** | BlackBox + SafetyAuditTrail + DeviceEventLog |
| Unreal Integration | **Placeholder** | Contract defined, no runtime |
| BP_SwarmManager | **Placeholder** | Interface only |

All adapters simulate realistic hardware behavior (discharge curves, fault injection, latency jitter) but do not connect to physical devices. This is by design — the platform is a diagnostic/supervision digital twin.

---

## Files to Create (7)
1. `src/core/hardware/adapters/DMXUniverseAdapter.ts`
2. `src/core/hardware/TelemetryPoller.ts`
3. `src/core/hardware/HardwareHealthMonitor.ts`
4. `src/core/hardware/DeviceDiscovery.ts`
5. `src/core/export/ExportCoordinator.ts`
6. `src/core/hardware/OperationalModeGuard.ts`
7. `src/core/verification/VerificationLog.ts`

## Files to Update (4)
1. `src/core/hardware/UnifiedHardwareRegistry.ts` — register DMXUniverseAdapter
2. `src/components/editor/ExportReadinessPanel.tsx` — use ExportCoordinator
3. `src/components/editor/HardwareOverview.tsx` — add discovery + health monitor
4. `src/components/editor/CurrentStateMatrix.tsx` — add DMX + ExportCoordinator rows

## Artifact
- `FXK_Hardware_Architecture_v6.mmd` — updated Mermaid diagram

