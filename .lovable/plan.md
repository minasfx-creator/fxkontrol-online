

# Ciclo #62 — Sprint 9: Performance Profiler Visual

## What Exists

| Component | Status |
|---|---|
| `usePerfMetrics` hook | FPS, memory, frameTime, drawCalls, triangles at 4Hz |
| `observability.ts` | RollingPercentile (p50/p95/p99), `getMetricsSnapshot()`, context loss tracking |
| `runtimeSafety.ts` | Watchdog with 5 degradation levels, `onDegradationChange()` callback |
| `memoryManager.ts` | `getMemoryReport(gl)` — geometries, textures, VRAM estimate, JS heap |
| `PerformanceMonitor` | Simple FPS/memory/latency cards in ShowCommander |
| `Sparkline` component | Reusable SVG trend line |
| `SafetyPanel` | 4 tabs — extensible pattern |

## Deliverables

### 1. PerformanceProfilerService — `src/core/performance/PerformanceProfilerService.ts`

Module-level singleton that collects time-series data for the profiler UI:

- **Frame Time History**: ring buffer of 600 samples (~10s at 60fps), stores `{ timestamp, frameTimeMs, drawCalls, triangles }`
- **Memory Snapshots**: sampled every 2s, ring buffer of 150 entries (~5min), stores `{ timestamp, jsHeapMB, geometries, textures, estimatedVRAM }`
- **Degradation Log**: append-only list of `{ timestamp, from, to }` transitions from watchdog
- **Alert Rules**: configurable thresholds that emit alerts:
  - FPS < 25 sustained 3s → `PERF_CRITICAL`
  - Memory > 1200MB → `MEMORY_HIGH`
  - VRAM > 400MB → `VRAM_HIGH`
  - Context loss → `GPU_CRASH`
- `getFrameHistory()`, `getMemoryHistory()`, `getDegradationLog()`, `getActiveAlerts()`
- Registers via `onDegradationChange()` on init

### 2. PerformanceProfilerTab — `src/components/editor/performance/PerformanceProfilerTab.tsx`

New dedicated panel (not inside SafetyPanel — standalone, accessed from ShowCommander or a new top-level panel). Three sections:

**A. Flame Chart (simplified)** — SVG bar chart showing frame time distribution:
- X-axis: last 300 frames (scrollable)
- Y-axis: frame time in ms, with 16.67ms budget line drawn as dashed red
- Bars color-coded: green (<16ms), amber (16-33ms), red (>33ms)
- Hover tooltip showing exact frameTime, drawCalls, triangles

**B. Memory Timeline** — dual-axis SVG line chart:
- JS Heap (MB) as filled area (blue)
- VRAM estimate as line (amber)
- Geometry/texture counts as small badges below
- Last 5 minutes of data

**C. Degradation Alerts** — live alert feed:
- Color-coded alert cards with timestamp and severity
- Current degradation level badge with color
- Auto-dismiss resolved alerts after 10s

### 3. Integration — ShowCommanderPanel

Add a "Profiler" section/tab in the Performance area of ShowCommander that lazy-loads the `PerformanceProfilerTab`.

## Files

| Action | File |
|--------|------|
| Create | `src/core/performance/PerformanceProfilerService.ts` |
| Create | `src/components/editor/performance/PerformanceProfilerTab.tsx` |
| Edit | `src/components/editor/ShowCommanderPanel.tsx` (add Profiler access) |

## Execution Order

| Step | Task |
|------|------|
| 1 | Create PerformanceProfilerService |
| 2 | Create PerformanceProfilerTab component |
| 3 | Integrate in ShowCommanderPanel |
| 4 | Build verification |

