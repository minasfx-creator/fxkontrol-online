
# Ciclo #60 — Sprint 7: Safety Audit Trail Visual Panel

## What Exists

| Component | Status |
|---|---|
| `SafetyAuditTrail` singleton | Functional — `getAll()`, `exportJSON()`, `persist()`, `load()`, `clear()` |
| `AuditEntry` interface | 10 event types: ARM, DISARM, FIRE, E_STOP, VIOLATION, STATE_CHANGE, LOCK, UNLOCK, RESET, CONTINUITY_CHECK |
| `SafetyPanel` | 2 tabs (Deconfliction, Flight Check) — extensible with 3rd tab |

## Deliverables

### 1. AuditTrailTab — `src/components/editor/safety/AuditTrailTab.tsx`

New lazy-loaded tab component:

- **Stats bar**: total entries badge + violation count (red badge when > 0)
- **Filter chips**: toggleable per event type + "ALL" toggle. Color-coded:
  - RED: E_STOP, VIOLATION
  - AMBER: ARM, FIRE, LOCK
  - GREEN: DISARM, UNLOCK, RESET, CONTINUITY_CHECK
  - BLUE: STATE_CHANGE
- **Actions**: Export CSV button + Clear History button (with confirm dialog)
- **History table** (ScrollArea 240px): Time (HH:MM:SS.ms), Tick, Event (color badge), From→To, Detail
- Auto-refresh polling `safetyAuditTrail.getAll()` every 2s
- CSV format: `Timestamp,Tick,Event,From,To,Detail,SiteID`

### 2. SafetyPanel — add "Audit Log" tab

Add 3rd tab with `ClipboardList` icon, lazy-load AuditTrailTab.

## Files

| Action | File |
|--------|------|
| Create | `src/components/editor/safety/AuditTrailTab.tsx` |
| Edit | `src/components/editor/SafetyPanel.tsx` (add 3rd tab) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create AuditTrailTab component |
| 2 | Add Audit Log tab to SafetyPanel |
| 3 | Build verification |
