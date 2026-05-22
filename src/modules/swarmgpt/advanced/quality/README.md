# SwarmGPT — Quality Analysis (RealityScan 2.0 mapping)

Pure, framework-free utilities that mirror the RealityScan 2.0 *Quality
Analysis* tools.

| RealityScan 2.0 concept | Module here |
|---|---|
| Tie Point Quality (camera coverage of sparse cloud) | `tiePointQuality.ts` |
| Mesh Quality (camera coverage of triangles) | `meshQuality.ts` |
| Green→Red color gradient | `qualityColorRamp.ts` |
| `calculateQualityColors` (vertex colorize) | `bake.ts` → `bakeVertexColors` |
| `calculateQualityTexture` (bake to image) | `bake.ts` → `bakeQualityTexture` |

All functions are deterministic and free of THREE / DOM dependencies. UI
bindings live in `src/components/editor/RealityScanQualityPanel.tsx` and are
gated by the `realityscan_quality_analysis` feature flag.
