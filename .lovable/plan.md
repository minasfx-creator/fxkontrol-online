

# FXK Platform — Refactoring Roadmap (Broadcast-Level Stability)

## System Snapshot

| Metric | Value |
|--------|-------|
| Total LOC | 177,930 |
| Files | 670 |
| Editor components | 196 (top-level `.tsx`) |
| Stores | 17 Zustand stores (3,623 LOC) |
| Hooks | 28 custom hooks (4,041 LOC) |
| Edge Functions | 12 |
| useProjectStore | 908 LOC (monolith — largest single file in state layer) |

---

## Audit Results: Identified Issues

### A. Redundant Component Pairs (Safe Zone — No Core Impact)

| Group | Components | Combined LOC | Issue |
|-------|-----------|-------------|-------|
| Safety | `SafetyPanel` + `SafetyCheckPanel` | 913 | Both read `useProjectStore`, both run safety checks, different engines (`safetyEngine` vs `skybrushSafetyCheck`). Should be unified behind a single panel with tabs. |
| Performance | `PerformanceHUD` + `PerformanceMonitor` | 277 | HUD is R3F in-scene collector; Monitor is HTML dashboard. Different scopes but share metric types. Should share a single `PerfMetrics` contract. |
| Show Control | `ShowControlPanel` (690 LOC) + `ShowCommanderPanel` (824 LOC) | 1,514 | Both are mission-control dashboards. Commander is the evolved version. Control should be deprecated. |
| DMX | 5 components (91K bytes total) | ~2,600 | `DMXPanel`, `DMXMonitorPanel`, `DMXMonitorGrid`, `DMXOutputPanel`, `DMXBezierEditor`. Grid and Output could be sub-components of Monitor. |
| Telemetry | `TelemetryBar` + `TelemetryDashboard` | ~460 | Bar is a compact strip; Dashboard is expanded. Could share a common data hook. |

### B. Store Architecture (Critical — Handle with Extreme Care)

**Current: 17 stores, 1 cross-import (SMPTE → Project)**

Good news: stores are almost entirely decoupled (only 1 cross-dependency). This is healthy.

**Problem: `useProjectStore` at 908 LOC is a monolith** containing:
- Editor state (mode, selection, panels)
- Timeline state (items, playback, currentTime)
- Position state (positions, groups)
- Show metadata (name, settings)
- Effect library (static constant)
- Wind/environment config

**Target consolidation (4 domain stores):**

```text
┌─────────────────────┐
│  useEditorStore     │ ← mode, selection, panels, UI state
├─────────────────────┤
│  useShowStore       │ ← metadata, positions, effects, wind
├─────────────────────┤
│  usePlaybackStore   │ ← timeline items, currentTime, play/pause
├─────────────────────┤
│  useExecutionStore  │ ← SMPTE, addressing, fleet, rack, USB
└─────────────────────┘
```

**But NOT now.** The monolith works, has zero circular deps, and 50+ components depend on it. Splitting requires:
1. Create `useEditorStore` as a facade that reads from `useProjectStore` (zero behavior change)
2. Migrate consumers one by one
3. Only after 100% migration, move state out of `useProjectStore`

### C. High-Coupling Components

Components importing 4-5 stores simultaneously:
- `MobileHUD.tsx` (5 stores)
- `LiveModeOverlay.tsx` (5 stores)
- `Toolbar.tsx` (4 stores)
- `ShowControlPanel.tsx` (4 stores)

These need facade hooks to reduce coupling.

### D. Edge Functions (Safe Improvement Zone)

12 functions, logically groupable into 4 domains:
- **Geo**: `get-maps-key`, `google-geo-intelligence`, `google-places-search`, `satellite-tile`
- **AI**: `fxk-ai-chat`, `generate-formation`, `video-choreo-ai`
- **Protocol**: `artnet-bridge`, `mavlink-bridge`, `timecode-bridge`
- **Utility**: `parse-test-report`, `warehouse-download`

No consolidation needed (edge functions must be individual), but shared utility code could be extracted to a `_shared/` directory.

---

## Refactoring Phases (Ordered by Safety)

### Phase 1: Component Deduplication (LOW RISK)

**Scope:** Editor UI only. Zero core/engine impact.

| Action | What | Risk |
|--------|------|------|
| Deprecate `ShowControlPanel` | Replace all references with `ShowCommanderPanel` (superset) | Low — Commander already exists |
| Unify `SafetyPanel` + `SafetyCheckPanel` | Create `SafetyPanelV2` with tabs for both engines, keep old exports as re-exports | Low — UI only |
| Extract `usePerfMetrics` hook | Shared metric contract for `PerformanceHUD` + `PerformanceMonitor` | None — additive |
| Extract `useTelemetryData` hook | Shared data layer for `TelemetryBar` + `TelemetryDashboard` | None — additive |

**Estimated reduction: ~1,500 LOC of duplication**

### Phase 2: Facade Hooks for High-Coupling Components (LOW RISK)

Create domain-specific selector hooks to reduce store coupling:

```typescript
// useEditorUI.ts — replaces 3-4 direct store imports
export function useEditorUI() {
  const editorMode = useProjectStore(s => s.editorMode);
  const isPlaying = useProjectStore(s => s.isPlaying);
  const selectedIds = useProjectStore(s => s.selectedPositionIds);
  // ...single import, memoized selectors
}
```

**Target components:** MobileHUD, LiveModeOverlay, Toolbar, ShowControlPanel

### Phase 3: DMX Component Hierarchy (MEDIUM RISK)

Restructure 5 DMX files into:
```text
DMXPanel.tsx (entry — tabs/routing)
├── DMXMonitor/ (was MonitorPanel + MonitorGrid)
├── DMXOutput/ (was OutputPanel)
└── DMXBezierEditor/ (standalone — specialized)
```

Keep all current exports as re-exports for backward compat.

### Phase 4: useProjectStore Progressive Split (HIGH RISK — Future)

This is the most impactful change. NOT recommended for immediate execution.

**Pre-requisites before starting:**
1. All Phase 1-3 complete and stable
2. Full E2E test coverage on editor, timeline, simulation flows
3. Facade hooks from Phase 2 adopted across all consumers

**Approach:**
1. Extract `EFFECT_LIBRARY` to its own module (it is a static constant, not state)
2. Create `useEditorStore` as a proxy that subscribes to `useProjectStore` slices
3. Migrate 10 components at a time
4. Only after 100% migration, move actual state

### Phase 5: Edge Function Shared Utils (LOW RISK)

Extract common patterns (CORS, auth validation, error formatting) into `supabase/functions/_shared/`.

---

## What We Do NOT Touch

| System | Reason |
|--------|--------|
| `fxkEngine.ts` | Deterministic 60Hz loop — production |
| `timelineEngine.ts` | Playback core — production |
| `fireworkEngine.ts` | Zero-GC simulation — production |
| `frameSyncEngine.ts` | SMPTE/audio sync — production |
| `SkyCanvas.tsx` (render logic) | R3F pipeline — production |
| `PostProcessing.tsx` | GPU pipeline — production |
| Protocol libraries (Art-Net, DMX, OSC, MAVLink) | Complete and stable |
| `useUndoStore` | Undo/redo integrity |

---

## Execution Order

```text
Phase 1 ─── Component Dedup ──────── 1-2 sessions ── LOW RISK
Phase 2 ─── Facade Hooks ─────────── 1 session ───── LOW RISK  
Phase 3 ─── DMX Hierarchy ────────── 1 session ───── MEDIUM RISK
Phase 5 ─── Edge Function Utils ──── 1 session ───── LOW RISK
Phase 4 ─── Store Split ──────────── 3-4 sessions ── HIGH RISK (future)
```

## Recommendation

Start with **Phase 1** (ShowControlPanel deprecation + Safety unification). It delivers the highest signal-to-noise improvement with zero risk to critical systems.

