

## SwarmGPT Advanced — Nível 2 (asset → formation pipeline)

Add asset adapters (SVG, RealityScan mesh, Gaussian Splat), weighted sampling, greedy matching with diagnostics, and a fidelity score. All isolated in `src/modules/swarmgpt/advanced/<subdirs>/`. No UI, no runtime, no edge function. Pure TypeScript, deterministic where possible, reuses `Vec3` and `distance3`.

### New files (all under `src/modules/swarmgpt/advanced/`)

1. **`svg/svgPathToPoints.ts`**
   - Types: `SvgSamplePoint = { x: number; y: number }`.
   - `svgPointsToDronePoints(points, { scale, center }) → Vec3[]` — normalizes around centroid, scales by `max(width, height)`, maps SVG Y → world Z (negated), keeps Y = `center.y`.

2. **`gaussian/gaussianToPointCloud.ts`**
   - Types: `GaussianSplatPoint = { position: Vec3; scale?: Vec3; opacity?: number; color?: string }`.
   - `gaussianSplatsToPointCloud(splats, { minOpacity = 0.15, maxPoints = 10000 }) → Vec3[]` — opacity filter then slice.

3. **`realityscan/realityScanAdapter.ts`**
   - Types: `RealityScanMeshLike = { vertices: Vec3[]; name?: string }`.
   - `realityScanMeshToPointCloud(mesh, { maxVertices = 20000 }) → Vec3[]` — deterministic stride sampling when `vertices.length > maxVertices`.

4. **`sampling/weightedPoissonSampling.ts`**
   - Types: `WeightedPoint = { point: Vec3; weight?: number }`.
   - `weightedPoissonSample(candidates, targetCount, minDistance) → Vec3[]` — sort by weight desc, greedy keep-if-far-enough, then relax distance in 0.85x steps down to `0.3 × minDistance`. Returns at most `targetCount` (does not pad — Nível 1's `poissonSample` already pads when called from the pipeline).

5. **`motion/hungarianLite.ts`**
   - `matchPointsByGreedyCost(from, to) → Vec3[]` — greedy nearest-neighbor pairing. Distinct from existing `matchPointsGreedy` in `trajectoryOptimizer.ts` (kept separate to preserve Nível 1 surface).

6. **`motion/optimizeDroneTransition.ts`**
   - Types: `TransitionOptimizationReport = { points; maxDistance; avgDistance; maxSpeed; valid }`.
   - `optimizeDroneTransition(from, to, { duration, maxDroneSpeed }) → TransitionOptimizationReport` — wraps `matchPointsByGreedyCost` and computes diagnostics.

7. **`scoring/scoreFormationFidelity.ts`**
   - Types: `FormationFidelityScore = { score; coverage; distribution; pointCount }`.
   - `scoreFormationFidelity(originalCandidates, sampledPoints)` — `score = coverage*0.7 + distribution*0.3`. Guards empty inputs.

8. **`index.ts`** — append re-exports for all seven new files. Existing Nível 1 exports stay intact.

### Constraints

- Use `Vec3` from `src/modules/swarmgpt/types.ts` and `distance3` from `src/modules/swarmgpt/utils/geometry.ts`.
- No new dependencies, no DOM, no Three.js, no fetch.
- TypeScript strict-safe; guard empty arrays and zero `duration`.
- Deterministic (no `Math.random`) for the sampling/matching — only greedy/sorting.

### Out of scope (saved for next step)

- `advanced/image/silhouetteToPoints.ts` — needs Canvas/ImageData; revisit when we add a UI/Worker.
- `advanced/assets/createFormationFromAdvancedAsset.ts` (the unified asset → `DroneFormation` factory).
- Wiring into `pipeline/generateSwarmGPTShow.ts` — Nível 1 post-processing keeps using `poissonSample`/`matchPointsGreedy`. Nível 2 helpers are opt-in for asset-driven flows that don't exist yet.
- True Hungarian (O(n³)) matching, NeRF integration, video-frame extraction.
- Edge function `swarmgpt-json` and UI preview (already deferred from earlier plans).

### Validation

- `tsc --noEmit` clean.
- Pure functions; no module-level side effects.
- Existing pipeline behavior unchanged (no edits to `pipeline/`, `config.ts`, or top-level `index.ts` beyond adding the `advanced/index.ts` re-exports — which `src/modules/swarmgpt/index.ts` already wildcard-exports via `export * from './advanced'`).

### Files touched

- **Create**: `src/modules/swarmgpt/advanced/svg/svgPathToPoints.ts`, `gaussian/gaussianToPointCloud.ts`, `realityscan/realityScanAdapter.ts`, `sampling/weightedPoissonSampling.ts`, `motion/hungarianLite.ts`, `motion/optimizeDroneTransition.ts`, `scoring/scoreFormationFidelity.ts`.
- **Edit**: `src/modules/swarmgpt/advanced/index.ts` (append seven re-exports).

