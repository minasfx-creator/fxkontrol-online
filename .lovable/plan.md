

## SwarmGPT Advanced — Bug fixes, cleanup & 3D model extraction (Nível 3)

Three things in one pass: (1) fix concrete bugs in the advanced module, (2) consolidate duplicated/old code, (3) add **3D model (.glb / .gltf / generic mesh) → drone formation** extraction. Module stays isolated — no UI changes, no pipeline wiring beyond the existing post-processing block.

---

### A. Bug fixes (advanced module)

1. **`advanced/poissonSampling.ts`** — remove `Math.random()`.
   - Replace biased `sort(() => Math.random() - 0.5)` with a **deterministic seeded shuffle** (mulberry32 PRNG seeded from input length + first/last point coords). Result: same input → same output, every run.
   - Tighten the relax-fallback loop: drop unused `i` index check; use `Set<number>` of selected indices for O(1) lookup instead of `selected.includes(p)` (O(n) reference compare).

2. **`advanced/beatSync.ts`** — fix float drift in `buildBeatGrid`.
   - Compute `count = Math.floor(duration * bpm / 60) + 1`, then `beats[i] = i * 60 / bpm`. No accumulator.

3. **`pipeline/generateSwarmGPTShow.ts`** — pre-index transitions and sort formations.
   - Build `transitionByTo = new Map<string, DroneTransition>()` once before the matching pass (current `.find()` inside `.map()` is O(F·T)).
   - After beat-snap, sort `plan.formations` and `plan.transitions` by `startTime` (stable) so collisions surface in `validateChoreographyPlan`.

4. **`advanced/generateOptimizedFormation.ts`** — surface speed-check result.
   - Return `{ points, speedOk }` from `optimizeTransition` (or keep `Vec3[]` and add `optimizeTransitionWithReport`). Pipeline ignores `speedOk` for now (matches current behavior) but it's available to callers. Backwards-compatible: keep the `Vec3[]`-returning function; add a `*WithReport` sibling.

---

### B. Cleanup (consolidation, no behavior change)

5. **Remove duplication between Nível 1 & Nível 2 greedy matching.**
   - `motion/hungarianLite.ts::matchPointsByGreedyCost` is identical to `trajectoryOptimizer.ts::matchPointsGreedy`. Make `matchPointsByGreedyCost` a thin re-export wrapper around `matchPointsGreedy` so there is one implementation. Both names stay exported (no breaking change).

6. **Internal-only `pipeline/postProcess.ts`** (extract from `generateSwarmGPTShow.ts`).
   - Move the four-step deterministic post-processing block (Poisson → beat-snap → transition matching → re-validate) into a single pure `applyAdvancedPostProcessing(plan, input, config)` helper. `generateSwarmGPTShow` becomes ~40 lines of orchestration. No public API change.

7. **No old UI to remove** — the SwarmGPT module is isolated; `SwarmGPTPanel.tsx` is the only consumer in the UI layer and is current. Out of scope.

---

### C. New: 3D model → formation (Nível 3)

New subdirectory `src/modules/swarmgpt/advanced/model3d/` — pure TypeScript, no DOM, no Three.js, no fetch. The UI layer (which already uses `useGLTF` in `SiteModelRenderer.tsx`) extracts vertices and hands them to this module.

8. **`model3d/types.ts`**
   ```ts
   export interface MeshLike {
     vertices: Vec3[];          // world-space or local-space, caller's choice
     indices?: number[];        // optional — enables surface-area weighting
     name?: string;
   }
   export interface ExtractFromMeshOptions {
     droneCount: number;
     minDistance: number;
     scale?: number;            // target diameter in meters (default 60)
     center?: Vec3;             // formation center (default {0, 50, 0})
     yUp?: boolean;             // mesh Y-up vs Z-up (default true)
     hollow?: boolean;          // surface-only (default true) vs filled
     maxCandidates?: number;    // cap before sampling (default 20000)
   }
   export interface ModelExtractionReport {
     points: Vec3[];
     candidateCount: number;
     fidelity: FormationFidelityScore;
     boundingBox: { min: Vec3; max: Vec3 };
   }
   ```

9. **`model3d/normalizeMesh.ts`** — `normalizeMeshToBounds(mesh, { scale, center, yUp })`
   - Compute AABB, recenter on origin, uniform-scale so `max(extent)` = `scale`, swap Y↔Z if `yUp === false`, translate to `center`. Returns new `Vec3[]` and `boundingBox`.

10. **`model3d/sampleSurfaceArea.ts`** — `sampleTrianglesByArea(vertices, indices, count)`
    - When indices are present, compute triangle areas, build CDF, sample points uniformly across the surface (area-weighted barycentric sampling). Deterministic via mulberry32 seeded from vertex count. Returns `WeightedPoint[]` (weight = local triangle density).

11. **`model3d/extractFormationFromMesh.ts`** — orchestrator
    - Pipeline: `normalizeMeshToBounds` → (if `indices` & `hollow`) `sampleTrianglesByArea` else use raw vertices → cap by `maxCandidates` (deterministic stride) → `weightedPoissonSample(candidates, droneCount, minDistance)` → if undersampled, pad via Nível 1 `poissonSample` fallback to guarantee count → `scoreFormationFidelity` → return `ModelExtractionReport`.
    - Reuses `weightedPoissonSample`, `realityScanMeshToPointCloud` (for the stride cap), and `scoreFormationFidelity` — no new sampling primitives.

12. **`model3d/index.ts`** — barrel for the four files above.

13. **`advanced/index.ts`** — append `export * from './model3d';`.

---

### Out of scope (kept for later)

- `.glb` / `.gltf` parsing. The module receives `MeshLike` (already-parsed vertices). UI layer uses existing `useGLTF` to traverse meshes and call `mesh.geometry.attributes.position` → `Vec3[]`. A thin `src/lib/swarmgpt/gltfToMeshLike.ts` adapter (DOM/Three side) is left for the next plan when we wire the UI panel.
- `SwarmGPTPanel.tsx` UI mode for "3D Model Upload" — separate plan; needs the gltf adapter first.
- True Hungarian matching, NeRF, video-frame extraction, edge function `swarmgpt-json` (already deferred).

### Validation

- `tsc --noEmit` clean.
- Pure functions; deterministic (mulberry32, no `Math.random`).
- `generateSwarmGPTShow` public signature unchanged. `SwarmGPTPanel.tsx` and `supabase/functions/generate-formation/index.ts` untouched (legacy `optimizeTransitionOrder` stays inside the edge function — it's a separate codepath the user already ships).

### Files touched

- **Edit**: `src/modules/swarmgpt/advanced/poissonSampling.ts`, `advanced/beatSync.ts`, `advanced/generateOptimizedFormation.ts`, `advanced/motion/hungarianLite.ts`, `advanced/index.ts`, `pipeline/generateSwarmGPTShow.ts`.
- **Create**: `src/modules/swarmgpt/pipeline/postProcess.ts`, `src/modules/swarmgpt/utils/random.ts` (mulberry32 + seeded shuffle), `src/modules/swarmgpt/advanced/model3d/{types,normalizeMesh,sampleSurfaceArea,extractFormationFromMesh,index}.ts`.

