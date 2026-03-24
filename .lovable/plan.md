

## Fix: Crash Sources in Lighting, Ground, Shadows & Smoke Modules

### Problems Found

**1. SFXStageEnvironment has ~35+ PointLights (CRITICAL)**
Lines 903-1057 of `GroundSystem.tsx`: The `SFXStageEnvironment` creates an enormous number of lights:
- 20 moving head `pointLight` (line 948, one per beam)
- 3 laser mount `pointLight` (line 903)
- 3 orb `pointLight` (line 973)
- 4 DMX `pointLight` (line 1031-1037)
- 3 fill `pointLight` (line 1049)
- 4 standalone `pointLight` (lines 1054-1057)
- 1 `ambientLight` + 1 `directionalLight` (lines 1052-1053)

Total: ~38 lights in one component. WebGL has 8-16 texture unit limit. This alone can cause context loss, especially if shadows are enabled elsewhere.

**2. ExplosionGlowSystem adds 8 more PointLights on top (line 36)**
Pool of 8 `THREE.PointLight` objects added directly to scene. Combined with SFXStage = ~46 lights.

**3. Camera altitude clamp feedback loop (STILL PRESENT)**
Lines 970-975 of `SkyCanvas.tsx`: The damping block `if (cy < 20)` is still there despite previous "fix" attempts. When camera starts near ground (e.g. after preset switch), `dampFactor = cy/20 ≈ 0.3` creates a viscous trap — each frame the camera loses altitude, which reduces `dampFactor` further, pulling it to `CAMERA_MIN_Y=5`.

**4. GC allocation in ExplosionGlowSystem (line 95-97)**
Every burst spawns `new THREE.Color()` twice per frame inside useFrame — violates zero-GC policy and can cause jank during heavy burst sequences.

**5. GroundReflections 100k×100k plane with per-pixel noise**
Line 281: A single plane covering 100k×100k units with 5-octave noise in the fragment shader. On lower GPUs, this full-screen shader can stall the pipeline and contribute to context loss when combined with the light count.

**6. ContactShadows with scale=200 + all the lights**
Line 113: `ContactShadows` renders a separate shadow pass. Combined with 38+ lights, this multiplies GPU work.

---

### Plan

#### Step 1: Drastically reduce SFXStageEnvironment lights
**File**: `src/components/editor/skycanvas/GroundSystem.tsx`
- Remove individual `pointLight` from each moving head beam (20 lights → 0)
- Keep only 3-4 key area lights max for the stage
- Remove orb pointLights (visual glow from emissive material is sufficient)
- Remove laser mount pointLights
- Cap total stage lights at **5** (1 ambient + 1 directional + 3 point)

#### Step 2: Fix ExplosionGlowSystem GC + reduce pool
**File**: `src/components/editor/skycanvas/ExplosionGlowSystem.tsx`
- Reduce pool from 8 to 4 PointLights
- Pre-allocate reusable `THREE.Color` at module level instead of `new` inside useFrame
- Set `light.castShadow = false` explicitly on pool lights

#### Step 3: Remove camera altitude damping loop
**File**: `src/components/editor/SkyCanvas.tsx`
- Delete lines 970-975 (the `if (cy < 20)` damping block) entirely
- Keep only: hard floor clamp at `CAMERA_MIN_Y` and the drop-limit (already at 200 or raise to 500)
- This eliminates the feedback loop that "sucks" the camera down

#### Step 4: Optimize GroundReflections
**File**: `src/components/editor/skycanvas/LightingSystem.tsx`
- Reduce plane size from 100k to 10k (still huge, but 100x less fragment work)
- Or conditionally render only when `groundStyle !== 'sfx-stage'`

#### Step 5: Guard ContactShadows
**File**: `src/components/editor/skycanvas/LightingSystem.tsx`
- Add `resolution={256}` (down from 512) as default
- Reduce `scale` from 200 to 80

### Files Changed
- `src/components/editor/skycanvas/GroundSystem.tsx` — light count reduction
- `src/components/editor/skycanvas/ExplosionGlowSystem.tsx` — pool size + zero-GC fix
- `src/components/editor/SkyCanvas.tsx` — remove damping loop
- `src/components/editor/skycanvas/LightingSystem.tsx` — reflection + shadow optimization

