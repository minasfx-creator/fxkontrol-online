# Render Engine 3D — Hardening

Canonical limits and runtime guardrails for the FX KONTROL 3D pipeline
(Three.js + React Three Fiber + custom GPGPU/instanced layers).

## Tier System

`renderQuality()` returns one of `cinema | balanced | eco`. Auto-detected
from `WEBGL_debug_renderer_info` on first call; user can pin via
`localStorage.fxk.flag.render_quality`.

`renderStabilityController` (`src/render_ultra/stability/renderStabilityController.ts`)
samples `requestAnimationFrame` deltas in a rolling 60-frame window:

| Trigger                              | Action               |
|--------------------------------------|----------------------|
| p95 > 22ms for 60 consecutive frames | Degrade 1 tier       |
| p95 < 14ms for 300 consecutive frames | Try upgrade 1 tier  |
| User-pinned tier                     | Controller no-op     |

Components subscribe via `useRenderQualityTier()` and re-render on tier change.

## Geometry Budget

`geometryBudget` (`src/render_ultra/stability/geometryBudget.ts`) tracks
triangles + texture bytes across the active scene.

| Limit                            | Value         |
|----------------------------------|---------------|
| MAX_TRIANGLES_PER_ASSET          | 50 000        |
| MAX_TEXTURE_DIM                  | 2048          |
| MAX_TEXTURE_BYTES_PER_ASSET      | 16 MiB (RGBA8 @ 2048²) |
| MAX_VRAM_SCENE_MB                | 512           |

All `useOptimizedGLTF` loads register their asset entry. Library uploads
that exceed any per-asset limit are flagged in the UI ("Reduce mesh
density or texture dim before publishing").

## Upload Checklist

Before publishing a model to `user_library_assets`:

1. Convert to GLB (`gltf-pipeline`, Blender export, etc).
2. Triangle count ≤ 50 000. Use Blender Decimate or `gltf-transform simplify`.
3. Textures ≤ 2048², KTX2 (UASTC for color, ETC1S for normals OK).
4. Run `gltf-transform draco` for mesh compression (edgebreaker).
5. Generate LOD0 / LOD1 / LOD2 via `simplify ratio 1.0 / 0.5 / 0.25`.

The `optimize-library-asset` edge function (rodada 3) runs this
pipeline automatically on upload and stores `<asset>.optimized.glb`.

## Forbidden

- `MeshStandardMaterial` on instanced particles (use `MeshBasicMaterial`
  + additive blend or custom shader).
- Per-frame `new` of `THREE.Vector3` / `THREE.Color` inside `useFrame`.
- `MapsAllocated > 256` per scene — cap aggressive cloners.
- Per-drone React component in show playback (use `InstancedDroneField`).
