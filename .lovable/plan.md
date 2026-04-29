# Engine 3D + AI Show Builder — Hardening Plan

Goal: eliminate "black viewport" failures, decouple ShowPlan from Three.js, and add a permanent PromptBar with deterministic playback/scrub.

The work splits into **8 self-contained phases**. Each one is independently shippable; later phases assume earlier ones.

---

## Phase 1 — Viewport state machine + overlays

New: `src/lib/showEngine/viewportState.ts`
```ts
export type ViewportState =
  | 'booting' | 'ready' | 'empty'
  | 'rendering' | 'error' | 'contextLost';
```

New components in `src/components/show-engine/overlays/`:
- `ViewportBootingOverlay.tsx` — "Inicializando cena 3D…"
- `EmptySceneOverlay.tsx` — "Nenhuma cena carregada" + CTA "Gerar com IA".
- `ViewportErrorOverlay.tsx` — error message + "Resetar cena".
- `RecoverWebGLOverlay.tsx` — "Recuperar WebGL" button (calls `engine.recoverContext()`).

Wired into the canvas host (Studio + AIBuilder preview) so the canvas is **never** rendered alone — it's always behind one of these overlays whenever state ≠ `ready`/`rendering`.

## Phase 2 — EngineDiagnostics + WebGL recovery

New: `src/lib/showEngine/EngineDiagnostics.ts`
```ts
export interface EngineDiagnostics {
  webglAvailable: boolean;
  contextLost: boolean;
  fps: number;
  drawCalls: number;
  triangles: number;
  sceneObjects: number;
  lastError?: string;
}
```

- Subscriber model (`subscribe(cb)`) so React panels can read without polling.
- Reuse existing `webglEventLog.ts` and `hardening` watchdog metrics.
- Add `webglcontextlost` / `webglcontextrestored` listeners at the engine level (centralised, not per-component).
- Dev-only `<EngineDiagnosticsPanel/>` (toggle with `?debug=engine`) showing the struct live.

## Phase 3 — Show3DEngine façade with layers

New: `src/lib/showEngine/Show3DEngine.ts`
```ts
class Show3DEngine {
  staticLayer:  THREE.Group;  // site, grid, positions
  dynamicLayer: THREE.Group;  // drones, moving lights
  effectsLayer: THREE.Group;  // pyro, particles, smoke
  debugLayer:   THREE.Group;  // axes, bbox, frustum

  init(canvas: HTMLCanvasElement): void;
  dispose(): void;
  seek(showTime: number, opts?: { mode: 'playback' | 'scrub' }): void;
  renderFrame(realDelta: number): void;
  recoverContext(): void;
  getDiagnostics(): EngineDiagnostics;
}
```

- Renderer created **once** with `antialias: true, alpha: false, powerPreference: 'high-performance'`.
- `setPixelRatio(Math.min(devicePixelRatio, 2))`.
- Disposes cleanly on unmount (mirror existing `deepDispose`).
- Exposes a single `CameraController` (Phase 5).

This is the only class React talks to. No component creates meshes directly anymore.

## Phase 4 — SceneAdapter (ShowPlan → SceneGraph)

New: `src/lib/showEngine/SceneAdapter.ts`
```ts
type SceneGraph = {
  root: SceneNode;
  site: SiteNode;
  positions: PositionNode[];
  drones: DroneNode[];
  pyro: PyroNode[];
};

export function adaptShowPlanToSceneGraph(plan: ShowPlan): SceneGraph;
```

- Pure function, fully unit-testable (no Three.js types in the public shape — only plain data).
- Engine consumes the SceneGraph and builds layer contents.
- Decouples canonical `ShowPlan` from rendering; future formats (drones-only, pyro-only) plug in via additional adapters.

New: `src/lib/showEngine/validateSceneGraph.ts`
- `validateSceneGraph(graph)` — non-empty children, finite coords, valid site bounds.
- `validateViewportRenderable(engine)` — renderer size > 0, camera aspect finite, scene.children > 0.
- Surfaces results into the viewport state machine (`error` if invalid).

## Phase 5 — CameraController + Reset View

New: `src/lib/showEngine/CameraController.ts`
```ts
frameSite(site)
focusPosition(positionId)
focusAll()
resetView()
updateAspect(w, h)
```

- Auto-call `frameSite(plan.site)` on first scene load (fixes "loaded but camera looks at void" black viewport).
- Persistent floating button "Reset View" in the editor toolbar.
- Listens to `ResizeObserver` on canvas container.

## Phase 6 — TimelineCompiler + deterministic seek + EffectPool

New: `src/lib/showEngine/timelineCompiler.ts`
```ts
type CompiledCue = {
  id: string; startTime: number; endTime: number;
  commands: SceneCommand[];
};
type CompiledTimeline = { cues: CompiledCue[]; duration: number };
export function compileTimeline(plan: ShowPlan): CompiledTimeline;
```

- Compile once on plan load (memoized by `plan.id` + version).
- `engine.seek(time, { mode })`:
  - `playback`: incremental (apply only newly-active commands).
  - `scrub`: clear `effectsLayer`, rewind to `time`, replay in fast-forward to settle persistent state.
- Render loop uses `realDelta` (smooth) but visual state always derives from `showTime` (deterministic) — separation explicit.

New: `src/lib/showEngine/EffectPool.ts`
```ts
class EffectPool<T> { acquire(): T; release(item: T): void; }
```

- Pre-allocated pools for sparks/smoke/flash meshes.
- Reuses existing `geometryPool` / `bufferPool` patterns.

## Phase 7 — Permanent PromptBar

New: `src/components/show-engine/PromptBar.tsx`
- Fixed overlay above the timeline, visible **always** in `/studio` and `/ai-builder` editors (not only inside the side panel).
- Layout: input (multiline-collapsed) · provider/status chip (`local-deterministic`, `remote`, `fallback`) · buttons: **Gerar**, **Refinar**, **Reset View**.
- Placeholder: *"Descreva o show ou ajuste a cena… ex: finale dourado com drones em espiral"*.
- Shortcuts:
  - `Enter` → generate/refine
  - `Shift+Enter` → newline
  - `Cmd/Ctrl+Enter` → apply (materializeShowPlan)
  - `Esc` → close suggestions, never hide bar
- Calls existing `generateShowPlanWithProviderDetailed` and shows `fellBack` indicator in real time.
- Stays mounted across viewport resize/orientation changes (uses unified `pipelineModel`, no per-breakpoint divergence).

## Phase 8 — Tests + acceptance

New tests under `src/lib/showEngine/__tests__/`:
- `viewportState.test.ts` — transitions are exhaustive.
- `sceneAdapter.test.ts` — deterministic ShowPlan → SceneGraph (snapshot).
- `validateSceneGraph.test.ts` — empty plan flagged, invalid coords flagged.
- `timelineCompiler.test.ts` — compile is pure, scrub does not accumulate effects.
- `effectPool.test.ts` — acquire/release re-uses instances.
- `engine.contextLoss.test.ts` — simulate `webglcontextlost` event → state goes to `contextLost`, `recoverContext()` returns to `ready`.

Acceptance checklist (explicit):
1. Viewport never shows raw black: an overlay matches every non-`ready` state.
2. Empty editor shows "Nenhuma cena carregada" + CTA.
3. After plan load, camera frames the site automatically.
4. `scene.children.length > 0` after init (asserted via diagnostics).
5. **Reset View** works from PromptBar.
6. PromptBar is visible on `/studio` and `/ai-builder`, all viewports.
7. Timeline scrub does not accumulate ghost particles.
8. `webglcontextlost` shows the recovery overlay; `recoverContext()` restores rendering.
9. No React component imports `THREE.Mesh` directly to mutate scene; all goes through `Show3DEngine`.
10. Timeline modules have **zero** imports from `three`.

---

## Out of scope (explicit)

- Replacing the existing SkyCanvas pipeline wholesale — this plan **wraps** it behind `Show3DEngine` so the existing FXK engine, watchdogs, hardening and FXKQualityController keep running underneath.
- Changing the ShowPlan schema or the local/remote provider contract.
- Replacing the existing `pipelineModel` parity work — it stays as the canonical data layer.

## File summary

New (≈18 files):
- `src/lib/showEngine/{viewportState,EngineDiagnostics,Show3DEngine,SceneAdapter,validateSceneGraph,CameraController,timelineCompiler,EffectPool}.ts`
- `src/components/show-engine/PromptBar.tsx`
- `src/components/show-engine/overlays/{ViewportBootingOverlay,EmptySceneOverlay,ViewportErrorOverlay,RecoverWebGLOverlay,EngineDiagnosticsPanel}.tsx`
- 6 test files under `src/lib/showEngine/__tests__/`

Edited (≈4 files):
- `src/components/ai-show-builder/AIShowBuilderPanel.tsx` — wire PromptBar + Reset View.
- `src/pages/AIBuilder.tsx` and Studio host — mount engine + overlays.
- `src/lib/aiShowBuilder/materializeShowPlan.ts` — emit a "plan applied" event the engine subscribes to (for auto `frameSite`).