

## SwarmGPT Advanced — Module X (high-fidelity geometry & motion)

Add an isolated `advanced/` submodule that improves visual quality and motion smoothness, plus optional beat sync. Wired into the existing pipeline as a deterministic post-processing step **after** the enhancer/repair loop and **before** the compiler. No UI, no edge function in this scope.

### New files (all under `src/modules/swarmgpt/advanced/`)

1. **`poissonSampling.ts`** — `poissonSample(points, targetCount, minDistance): Vec3[]`
   - Random shuffle, greedy keep-if-far-enough, padded fallback to guarantee `targetCount`.
   - Reuses `distance3` from `utils/geometry`.

2. **`trajectoryOptimizer.ts`** — `matchPointsGreedy(from, to)` + `validateSpeed(from, to, duration, maxSpeed)`
   - Greedy nearest-neighbor pairing to reduce travel distance during transitions.
   - Boolean speed-feasibility check (m/s).
   - Note: project already has a separate `src/lib/trajectoryOptimizer.ts` (Catmull-Rom smoothing, velocity clamping). The new file lives inside the SwarmGPT module and serves a different role (point-to-point matching for formation transitions). They do not collide.

3. **`beatSync.ts`** — `snapToBeat(time, beats): number`
   - Returns the closest beat to `time`; pass-through if `beats` is empty.

4. **`generateOptimizedFormation.ts`** — orchestrator helpers
   - `generateOptimizedFormation(rawPoints, droneCount, minDistance)` → Poisson-sampled formation.
   - `optimizeTransition(from, to, duration, maxSpeed)` → matched target order; falls back to matched order even when speed check fails (caller decides what to do).

5. **`index.ts`** — re-exports all four files.

### Pipeline integration (`pipeline/generateSwarmGPTShow.ts`)

After the repair loop succeeds and before `compilePlanToTimeline(plan)`:

```ts
// Geometry pass — Poisson resample each formation to enforce min distance.
plan = {
  ...plan,
  formations: plan.formations.map(f => ({
    ...f,
    points: generateOptimizedFormation(f.points, input.droneCount, config.minDroneDistance),
  })),
};

// Optional beat snap on transitions/formations when bpm provided.
if (input.bpm && input.bpm > 0) {
  const beats = buildBeatGrid(input.bpm, input.duration); // local helper
  plan = {
    ...plan,
    formations: plan.formations.map(f => ({ ...f, startTime: snapToBeat(f.startTime, beats) })),
    transitions: plan.transitions.map(t => ({ ...t, startTime: snapToBeat(t.startTime, beats) })),
  };
}

// Transition matching pass — greedy reorder of `to.points` to minimize travel.
const formationById = new Map(plan.formations.map(f => [f.id, f]));
plan = {
  ...plan,
  formations: plan.formations.map(f => {
    const incoming = plan.transitions.find(t => t.toFormationId === f.id);
    if (!incoming) return f;
    const fromF = formationById.get(incoming.fromFormationId);
    if (!fromF) return f;
    return {
      ...f,
      points: optimizeTransition(fromF.points, f.points, incoming.duration, config.maxDroneSpeed),
    };
  }),
};

// Re-validate after deterministic mutations (no extra repair loop — pure geometry).
const finalValidation = validateChoreographyPlan(plan, input, config);
if (!finalValidation.ok) return { ok: false, refinedPrompt, plan, critique, validation: finalValidation, error: 'Advanced post-processing produced invalid plan.' };
```

### Config additions (`config.ts`)

Add one optional field with a sane default — no breaking changes:

```ts
export interface SwarmGPTConfig {
  llm: SwarmGPTLLMClient;
  minDroneDistance: number;
  maxRepairAttempts: number;
  /** Max instantaneous speed (m/s) used by the trajectory optimizer. */
  maxDroneSpeed: number;
}
// createDefaultSwarmGPTConfig: maxDroneSpeed: 8.0  (matches DEFAULT_CONSTRAINTS in src/lib/trajectoryOptimizer.ts)
```

### Public surface (`index.ts`)

Add `export * from './advanced';` so consumers can import the helpers directly if needed.

### Out of scope (kept for later, per your "nível 2" note)

- Edge function `swarmgpt-json` (the prompt you provided — will be a separate plan).
- UI preview panel.
- Hungarian (optimal) matching, NeRF/Gaussian splatting, SVG→formation extractor.
- Calling `src/lib/trajectoryOptimizer.ts` for Catmull-Rom smoothing of full trajectories (current scope only matches endpoints).

### Validation

- `tsc --noEmit` clean.
- Pure functions — no runtime/timeline coupling.
- Final `validateChoreographyPlan` re-run guarantees Poisson resample never drops below `droneCount` (fallback path) and bounds/timing remain valid.

### Files touched

- **Create**: `src/modules/swarmgpt/advanced/{poissonSampling,trajectoryOptimizer,beatSync,generateOptimizedFormation,index}.ts`
- **Edit**: `src/modules/swarmgpt/config.ts` (add `maxDroneSpeed`), `src/modules/swarmgpt/pipeline/generateSwarmGPTShow.ts` (post-processing block + `buildBeatGrid` helper), `src/modules/swarmgpt/index.ts` (re-export).

