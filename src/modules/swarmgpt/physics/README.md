# SwarmGPT Physics

Pure, hardware-free physics layer that turns matched drone formations into
validated, repairable trajectories. Lives between formation generation and
timeline compilation.

## Pipeline

```
from/to formations
  ↓ matchPointsByCost          (greedy O(N²) → Hungarian fallback, N ≤ 512)
  ↓ compilePhysicalTrajectory  (eased samples + optional altitude lanes)
  ↓ validateKinematics         (speed / acceleration / jerk)
  ↓ validateCollisions         (uniform spatial hash, every sample)
  ↓ validateBounds             (every sample inside Bounds)
  ↓ repairPhysicalTransition   (extend duration → rematch → altitude lanes → fail)
  ↓ buildPhysicsReport         (always — issues + aggregate metrics)
```

## Strict boundary

No React, no Three.js, no hardware. Only `../types` and `../utils/geometry`
are touched. Safe to use in workers, edge functions, and tests.

## Public surface

```ts
import {
  matchPointsByCost,
  compilePhysicalTrajectory,
  validateKinematics,
  validateCollisions,
  validateBounds,
  buildAltitudeLanes,
  repairPhysicalTransition,
  buildPhysicsReport,
  pickAdaptiveSampleRate,
  pickEasing,
  type MotionStyle,
  type PhysicsLimits,
  type PhysicsReport,
  type PhysicalTrajectory,
} from '@/modules/swarmgpt/physics';
```

## Adaptive sampling

Sample rate scales inversely with swarm size to keep validation O(N) per frame:

| Drones    | Hz (final) | Hz (preview) |
|-----------|-----------:|-------------:|
| ≤ 100     | 20         | 20           |
| ≤ 500     | 10         | 10           |
| ≤ 2000    | 10         | 5            |
| > 2000    | 6          | 4            |

Bounded by `maxSamples` (default 1024) and `maxRate` (default 30 Hz).

## Severity model

| Severity   | Examples                                      |
|------------|-----------------------------------------------|
| `warning`  | speed within 25% over the limit, jerk spikes  |
| `error`    | collision (separation < min), strong speed    |
| `blocker`  | bounds violation, separation < 50% of min     |

Issues array is hard-capped (`DEFAULT_MAX_ISSUES = 200`) and reports
`truncated: true` on overflow to keep payloads bounded.

## Repair strategies (in order)

1. **Extend duration** — multipliers `[1.25, 1.5, 2]` slow the swarm.
2. **Rematch** — force Hungarian to escape adversarial greedy pairings.
3. **Altitude lanes** — bucket drones into vertical lanes by travel yaw.
4. **Fail** with a clear `repair`/`blocker` issue and full `repairLog`.

## Integration

Opt-in from the formation pipeline. Gated by feature flag
`swarmgpt_physics_repair`:

```ts
planFormationFromAsset(asset, previousPoints, {
  droneCount, minDistance, maxSpeed, duration, cueTime,
  usePhysicsRepair: true,
  motionStyle: 'cinematic',
});
// → plan.physics: PhysicsReport
```
