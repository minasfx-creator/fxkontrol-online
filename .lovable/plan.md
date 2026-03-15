

# Plano: Integração Final — GPU Spark Trails + HDR Lighting Rig + Drone PBR Materials

## Diagnóstico

**Já integrados (9/12):** Adaptive Exposure, Global Illumination, Particle Chemistry, Ground Reflections, Smoke System, Lens Flares, Volumetric Fog FBM, Burst Configs, Sky Scatter (via AdaptiveExposureController uniforms).

**Dormentes (3/12):**

| Tecnologia | Módulo | Problema |
|---|---|---|
| GPU Spark Trails | `fireworks/sparkTrailsGPU` | Não integrado — nenhum controller |
| HDR Lighting Rig | `lighting/hdrLighting` | `SceneLighting` usa luzes manuais em vez do rig calibrado |
| Drone PBR Materials | `drones/droneMaterials` | `InstancedDroneSwarm` usa materiais inline (metalness 0.95, roughness 0.08) em vez do carbon fiber calibrado (metalness 0.3, roughness 0.6) |

**SkyScatterController** (linha 1853): Existe mas é redundante — a lógica já roda dentro do `AdaptiveExposureController` (linhas 1685-1711). Pode ser removido.

## Alterações

### 1. GPU Spark Trails Controller
**Arquivo:** `src/components/editor/SkyCanvas.tsx`

**Import** (linha 64): Adicionar `createSparkTrailSystem`, `updateSparkTrail`, `writeSparkTrailsToBuffers`, `SparkState`

**Novo componente `SparkTrailController`** (após LensFlareController, ~linha 1850):
- `useEffect`: instancia `createSparkTrailSystem()`, adiciona `points` mesh à cena
- `useRef` para array de `SparkState[]` ativo (max 2048)
- No `useFrame`:
  - Detecta bursts com `elapsed < 0.05s` → spawna 20 sparks por burst com velocidade do `breakSpeed`, cor do compound, life calibrada por calibre
  - Loop em todos sparks vivos: `updateSparkTrail(spark, dt, 0.04, -9.81)` com wind
  - `writeSparkTrailsToBuffers(sparks, positions, colors, opacities)` 
  - Mark buffer attributes `needsUpdate = true`
  - Remove sparks mortos (`life <= 0`)
- Cleanup no return do useEffect

**Wiring no Canvas** (linha ~2498): `<SparkTrailController />`

### 2. HDR Lighting Rig (refatorar SceneLighting)
**Arquivo:** `src/components/editor/SkyCanvas.tsx`

Refatorar `SceneLighting` (linhas 2152-2179) para usar `createHDRLightingRig()`:
- Import `createHDRLightingRig` (já exportado no index.ts)
- Converter para componente imperativo com `useEffect` + `useThree().scene`
- Criar rig com config calibrada, adicionar `rig.group` à cena
- Manter controles do `useSceneStore` conectados via `rig.updateMoonIntensity()` e `rig.updateAmbient()`
- Manter os backfill/fill directional lights existentes
- Shadow config vem do rig (2048px default, bias -0.0001)

### 3. Drone PBR Materials
**Arquivo:** `src/components/editor/InstancedDroneSwarm.tsx`

- Import `createDroneMaterials` do render_ultra
- Substituir `bodyMat` inline por `materials.body` (carbon fiber: color 0x1a1a1a, metalness 0.3, roughness 0.6)
- Substituir `rotorMat` básico por material baseado em `materials.motors` (metalness 0.95, roughness 0.15) com transparência
- Manter LED/halo/nav mats como estão (são específicos para instanced rendering)

### 4. Cleanup — Remover SkyScatterController redundante
**Arquivo:** `src/components/editor/SkyCanvas.tsx`

Remover `SkyScatterController` (linhas 1853-1890) — lógica duplicada já presente no `AdaptiveExposureController`.

## Arquivos Editados
1. `src/components/editor/SkyCanvas.tsx` — SparkTrailController, HDR Lighting refactor, cleanup
2. `src/components/editor/InstancedDroneSwarm.tsx` — Drone PBR Materials

## Resultado
Todos os 12 sistemas render_ultra integrados e ativos. Spark trails GPU incandescentes com history buffer, iluminação HDR cinematográfica calibrada com shadow map, e drones com materiais PBR de fibra de carbono realistas.

