# Ciclo #60 — Sprint 7: Safety Audit Trail Visual Panel

## What Exists
- `SafetyAuditTrail` singleton with `getAll()`, `exportJSON()`, `persist()`, `load()`, `clear()`
- `AuditEntry` interface: timestamp, tick, event (10 types), from, to, detail, originSiteId
- `SafetyPanel` with 2 tabs (Deconfliction, Flight Check) — good place to add 3rd tab

## Deliverables

### 1. AuditTrailTab — `src/components/editor/safety/AuditTrailTab.tsx`

New lazy-loaded tab in SafetyPanel with:
- **Filter bar**: multi-select chips for event types (ARM, FIRE, E_STOP, VIOLATION, etc.), with "All" toggle
- **History table**: scrollable table showing timestamp (HH:MM:SS.ms), tick, event badge (color-coded), from→to, detail, siteId
- **Counters**: total entries, violations count, last event time
- **Actions**: Export CSV button, Clear History button (with confirmation)
- Auto-refresh via `useEffect` interval polling `safetyAuditTrail.getAll()` every 2s

Event badge colors:
- RED: E_STOP, VIOLATION, SHORT
- AMBER: ARM, FIRE, LOCK
- GREEN: DISARM, UNLOCK, RESET, CONTINUITY_CHECK
- BLUE: STATE_CHANGE

CSV export format: `Timestamp,Tick,Event,From,To,Detail,SiteID`

### 2. SafetyPanel — add "Audit Log" tab

Add 3rd tab with `ClipboardList` icon, lazy-load `AuditTrailTab`.

## Files

| Action | File |
|--------|------|
| Create | `src/components/editor/safety/AuditTrailTab.tsx` |
| Edit | `src/components/editor/SafetyPanel.tsx` (add 3rd tab) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create AuditTrailTab component |
| 2 | Add tab to SafetyPanel |
| 3 | Build verification |
