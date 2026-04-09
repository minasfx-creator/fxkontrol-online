

# Ciclo #61 — Sprint 8: Safety Metrics Dashboard

## What Exists

| Component | Status |
|---|---|
| `SafetyAuditTrail` singleton | 10 event types, `getAll()`, persist/load |
| `AuditTrailTab` | History table + filters + CSV export |
| `SafetyPanel` | 3 tabs (Deconfliction, Flight Check, Audit Log) |
| `SafetyStateMachine` | State + conditions readable |
| `ContinuityCheckService` | Pin report with ok/open/short |
| `observability.ts` | FPS/frameTime/drawCalls metrics via `getMetricsSnapshot()` |
| `Sparkline` component | Minimal SVG trend line |

## Deliverables

### 1. SafetyMetricsDashboard — `src/components/editor/safety/SafetyMetricsTab.tsx`

New tab in SafetyPanel with three sections:

**A. Event Counters** — Grid of cards counting audit events by type from `safetyAuditTrail.getAll()`:
- ARM / DISARM / FIRE / E_STOP / VIOLATION / CONTINUITY_CHECK counts
- Color-coded (red critical, amber warn, green ok)
- Updates every 2s (same polling pattern as AuditTrailTab)

**B. Violation Timeline** — SVG mini-chart showing violation/E_STOP events over time:
- X-axis: session time (bucketized into 30s intervals)
- Y-axis: event count per bucket
- Uses inline SVG bar chart (no recharts dependency needed, keeps it lightweight)
- Red bars for violations, amber for E_STOP

**C. System Health Indicators** — Current status panel:
- Safety state (from `safetyStateMachine.state`) with color badge
- Continuity status (from `continuityCheckService.getReport()`) — ok/total
- Link stability (from `safetyStateMachine.conditions`)
- Session uptime (from `getMetricsSnapshot().sessionDurationSec`)
- FPS health (from `getMetricsSnapshot()`) with Sparkline

### 2. SafetyPanel — add 4th "Metrics" tab

Add tab with `BarChart3` icon, lazy-load SafetyMetricsTab.

## Files

| Action | File |
|--------|------|
| Create | `src/components/editor/safety/SafetyMetricsTab.tsx` |
| Edit | `src/components/editor/SafetyPanel.tsx` (add 4th tab) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create SafetyMetricsTab component |
| 2 | Add Metrics tab to SafetyPanel |
| 3 | Build verification |

