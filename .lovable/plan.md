

# Plano: Expansão 5× + Wiring Toggles + View Transform V-Ray/Blender

## 5 Arquivos a Editar

### 1. `src/components/editor/SkyCanvas.tsx` — ~35 constantes escaladas + wiring

**Escala ×5 (todas as constantes):**
- Line 187: `gl_PointSize` base `1600.0` → `8000.0`
- Line 943: sky dome `[18000, 64, 64]` → `[90000, 64, 64]`
- Line 1122: Moon position `[1500, 2800, -2500]` → `[7500, 14000, -12500]`
- Line 1125: Moon radius `90` → `450`
- Line 1460: LOD blend `smoothstep(200.0, 600.0)` → `smoothstep(1000.0, 3000.0)`
- Line 1519: atmosphere fog `0.0015` → `0.0003`
- Line 1531: GrassGround `[20000, 20000, 16, 16]` → `[100000, 100000, 16, 16]`
- Lines 1551-1553: atmospheric spread `400` → `2000`
- Line 1574: recycle dist `40000` → `200000`
- Line 1641: FloorLogo `[200, 50]` → `[1000, 250]`
- Line 1675: ground fog `[2000, 2000, 1, 1]` → `[10000, 10000, 1, 1]`
- Line 1750: FinaleDark `[20000, 20000, 16, 16]` → `[100000, 100000, 16, 16]`
- Line 1815: FinaleDark fog `0.001` → `0.0002`
- Line 1833: Concrete `[20000, 20000]` → `[100000, 100000]`
- Line 2205: GroundReflections `[2000, 2000]` → `[10000, 10000]`
- Line 2265: flat-black `[20000, 20000]` → `[100000, 100000]`
- Line 2297: grid fade `800` → `4000`
- Line 2302: grid args `[2000, 2000]` → `[10000, 10000]`
- Line 2309: grid fade `1500` → `7500`
- Line 2445: shadow far `5000` → `25000`
- Line 2480: Stars `radius={2000} depth={800}` → `radius={10000} depth={4000}`
- Lines 2494-2496: rain spread `800` → `4000`
- Line 2553: `WORLD_HALF_EXTENT` `16000` → `80000`
- Line 2555: `CAMERA_MAX_Y` `15000` → `75000`
- Line 2562: target Y clamp `10000` → `50000`
- Line 2578: intro camera Y `500` → `2500`
- Line 2617: intro orbit Y `500` → `2500`
- Line 2638: sweep start `460` → `2300`
- Line 2687: `maxDistance={18000}` → `90000`
- Line 3099: `far={50000}` → `far={250000}`

**Camera presets ×5** (lines 123-133): scale all positions and targets proportionally.

**Wiring dos Environment Toggles** (lines 3102-3113):
- Ler `useSceneStore(st => st.environment)` no componente principal
- `{!env.disableSmoke && <SmokeController />}`
- `{!env.disableLighting && <GlobalIlluminationController />}`
- `{!env.disableLighting && <LensFlareController />}`
- `lowQualityMode` → `SceneStars` count ×0.5, skip `AtmosphericParticles`

**skyRotation** — no SkyGradient shader:
- Adicionar uniform `uSkyRotation` 
- No fragment shader, rotacionar `dir.xz` por `uSkyRotation` antes de calcular estrelas/aurora

### 2. `src/store/useSceneStore.ts` — Fog ×5

- Line 138-139: `fogNear: 500→2500`, `fogFar: 6000→30000`
- Lines 203-204: finale-night `fogNear: 800→4000, fogFar: 4000→20000`
- Line 256: overcast `fogFar: 800→4000`
- Line 270: foggy `fogFar: 400→2000`
- Line 321: rainy `fogFar: 600→3000`
- Lines 345-346: skybrush `fogNear: 1200→6000, fogFar: 8000→40000`
- Lines 388-389: finale-cinema `fogNear: 600→3000, fogFar: 3500→17500`
- Lines 430-431: depence-stage `fogNear: 200→1000, fogFar: 2000→10000`

### 3. `src/hooks/useLOD.ts` — Thresholds ×5

- `ultra: 200→1000`, `high: 600→3000`, `medium: 1500→7500`

### 4. `src/components/editor/ViewportRulers.tsx` — Escala expandida

- VERTICAL_MARKS: adicionar `1500, 2000, 3000, 5000`
- HORIZONTAL_MARKS: adicionar `1000, 2000, 5000`
- Vertical line `1000→5000`, tick width `2→10`, label offset `6→30`
- Tracking distance `80→400`
- Horizontal span `500→2500`, tick `1.5→7.5`, label offset `3→15`

### 5. `src/lib/niagaraBlenderRules.ts` — V-Ray View Transform

Adicionar sistema de color management profissional:

```typescript
export type ViewTransform = 'aces-filmic' | 'agx' | 'standard';

export function getViewTransformConfig(mode: ViewTransform) {
  // Retorna maxHDRChannel, maxHDRLuma, energyCap por modo
  // agx: highlights suaves (Blender 4.0 default)
  // aces-filmic: preserva saturação (padrão atual)  
  // standard: linear sem compress
}
```

Ajustar `clampNiagaraHDR` e `getMaxEnergy` para aceitar ViewTransform como parâmetro opcional.

