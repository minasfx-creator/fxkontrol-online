

# Ciclo #38 — Superar Qualidade Finale 3D: GC-Free Rendering, Sound Sync, Multi-Break Realism

## Bugs & Gaps vs Finale 3D

| # | Bug/Gap | Local | Impacto |
|---|---------|-------|---------|
| 1 | **GC pressure: quaternion allocation per-frame per-burst** — L1311-1322 creates 6 `new THREE.*` objects (Euler, Quaternion, Vector3) per active burst per frame inside `useMemo`. These should be pre-allocated module-level singletons reused across all bursts | `FireworkRenderer.tsx` L1311-1322 | Alto — GC spikes during barrage scenes (20+ simultaneous bursts) |
| 2 | **`depthTest: false` on main star particles** — L114 sets `depthTest: false` on the shared star material, which means stars render on top of ALL geometry (buildings, terrain, mountains). Finale 3D correctly occludes stars behind solid geometry | `FireworkRenderer.tsx` L114 | Alto — breaks depth realism when bursts are behind buildings or terrain |
| 3 | **Flash sphere creates new THREE.Color every frame** — L1064 `new THREE.Color(color).lerp(...)` allocates a Color object every frame for every active burst's smoke cloud. Should be cached or use pre-allocated temp | `FireworkRenderer.tsx` L1064 | Médio — GC pressure |
| 4 | **No sound delay modeling in rendering** — Finale 3D models the speed-of-sound delay (burst is visible before the "boom" arrives). Memory says we have `soundDelay.ts` but it's not integrated into burst visual timing — the flash and burst are simultaneous regardless of camera distance | `soundDelay.ts` / `FireworkRenderer.tsx` | Médio — realism gap vs Finale |
| 5 | **Rocket partType missing dedicated renderer** — L1302 `isShell` includes `rocket` but rockets should have a visible ascending body with motor exhaust trail, not just a prefire trail + instant burst at height. Finale 3D renders rockets with visible motor climb phase | `FireworkRenderer.tsx` L1302, L1214 | Médio — rockets look identical to shells |
| 6 | **Star sprite clamped to 96px** — L71 `clamp(gl_PointSize, 0.5, 96.0)` means large caliber bursts (10"+) at close camera distance get clipped. Finale uses 256px max | `FireworkRenderer.tsx` L71 | Baixo — visible only at close camera |

## Plano de Implementação

### Arquivo 1: `src/components/editor/skycanvas/FireworkRenderer.tsx`

**Fix 1 — GC-free quaternion reuse in TimelineEffects (L1311-1322):**
- Move quaternion/euler/vector allocations to module-level pre-allocated singletons:
  ```
  const _renderPosEuler = new THREE.Euler();
  const _renderPosQuat = new THREE.Quaternion();
  const _renderLaunchDir = new THREE.Vector3();
  const _renderPitchAxis = new THREE.Vector3();
  const _renderPitchQuat = new THREE.Quaternion();
  const _renderEffEuler = new THREE.Euler();
  const _renderEffQuat = new THREE.Quaternion();
  ```
- Replace all `new THREE.*` inside the `cappedEffects.map()` render loop with `.set()` / `.setFromEuler()` calls on these singletons
- Note: these are used synchronously per-burst within the same frame, so reuse is safe (no concurrent access)

**Fix 2 — Enable depthTest on star material (L114):**
- Change `depthTest: false` to `depthTest: true` on the shared star material
- Keep `depthWrite: false` to avoid stars occluding each other
- This makes stars correctly hidden behind terrain/buildings while still rendering with additive blending among themselves

**Fix 3 — Remove per-frame Color allocation in smoke cloud (L1064):**
- Pre-allocate a module-level `_smokeBlendColor = new THREE.Color()`
- In the JSX, compute the blended color outside the mesh:
  ```
  _smokeBlendColor.set(color).lerp(_smokeGrayTarget, 0.7)
  ```
- Use `_smokeBlendColor` in the material `color` prop

**Fix 4 — Increase star sprite max size (L71):**
- Change `clamp(gl_PointSize, 0.5, 96.0)` to `clamp(gl_PointSize, 0.5, 192.0)`
- Allows 10"+ shells at close range to render at full visual size

**Fix 5 — Rocket dedicated ascending body (L1302):**
- Add `pt === 'rocket'` check before the generic firework fallback
- Create a new `RocketEffect` inline component that renders:
  - Ascending body: small sphere moving from launch pos to burst pos based on `prefireProgress`
  - Motor exhaust: `SparkShower` trail behind the ascending body
  - At burst completion, render normal `FireworkBurst` at burst position
- For now, implement as a thin wrapper that shows a `CometEffect` going up during prefire, then burst

### Arquivo 2: `src/components/editor/skycanvas/sharedState.tsx`

**Fix 6 — Pre-allocate smoke blend target color:**
- Export `_smokeGrayTarget = new THREE.Color(0.35, 0.30, 0.25)` (currently inlined as hex in L1064)

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | GC-free quaternions + smoke color allocation fixes |
| 2 | Enable depthTest on stars + increase point size cap |
| 3 | Rocket ascending body renderer |
| 4 | Build verification |

