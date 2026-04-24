---
name: Fields Engine
description: Volumetric Field Engine em src/engine/fields/ — primitives (cone beam, gaussian, sphere shell, half-space, vortex), composition (combine/blend/mirror), attractors, samplers (importance + Poisson disk), symmetry. Integrado opcionalmente no SwarmGPTPanel via botão "Field Beam".
type: feature
---
Pipeline volumétrico para SwarmGPT, deduzido de cenas tipo "twin beam + cluster":
**primitives → combine/blend → sampler → attractors → formation points**.

API pública via `@/engine/fields`:
- Vec3 math, Field/Bounds/FieldSample types, mulberry32 (RNG determinístico)
- Primitives: `coneBeamField`, `gaussianClusterField`, `sphereShellField`, `halfSpaceField`, `vortexField`
- Composition: `combineFields` (aditivo), `blendFields` (lerp), `mirrorField`, `scaleField`
- Attractors: `attractToCenter`, `attractToLine`, `repelFromCenter`
- Samplers: `importanceSample`, `poissonDiskSample` (com SpatialHash)
- Symmetry pós-sample: `applySymmetry`, `applyRotationalSymmetry`

Determinístico via seed (mulberry32). Cobertura: 26 testes em `src/engine/fields/fields.test.ts` (Vec3, density, blend continuity, Poisson min-distance, simetria).

Integração SwarmGPTPanel: botão "🔦 Field Beam (Volumetric)" no modo `presets`. Constrói `coneBeam + gaussianCluster → mirror('x') → poissonDiskSample → attractToCenter`. Usa `droneCount` slider para densidade. Não substitui o pipeline planner/formations — é opcional.

NÃO inclui: WebGPU backend, image-to-field extractor (fase 2 se solicitado).
