

# Integração Final: Smoke, Lens Flares, Volumetric Fog, Burst Configs, Sky Scatter, Terrain PBR

## Arquivo editado
`src/components/editor/SkyCanvas.tsx`

## 1. Novos Imports (linha 58-61)
Adicionar imports dos 3 módulos render_ultra restantes:
- `SmokeSystem` de `fireworks/smokeSimulation`
- `createLensFlareSprite`, `flashLensFlare`, `decayLensFlare` de `postprocessing/lensFlare`
- `getBurstConfig`, `BurstPattern` de `fireworks/burstSimulation`

## 2. SmokeController (~após linha 1685)
Novo componente que:
- Instancia `SmokeSystem` global (4096 partículas) via useRef
- Adiciona `smokeSystem.mesh` à cena via `useThree().scene`
- No useFrame, detecta bursts recentes (elapsed < 0.05s) e chama `smokeSystem.emit(origin, 30, smokeColor, spread)`
- A cor da fumaça vem do compound químico (cinza quente)
- `smokeSystem.update(dt, windX, windZ)` integra vento do `getWindForce()`
- Cleanup no useEffect return

## 3. LensFlareController (~após SmokeController)
Novo componente que:
- Cria pool de 10 sprites reutilizáveis via `createLensFlareSprite()`
- Adiciona sprites à cena via `useThree().scene`
- No useFrame, detecta bursts com elapsed < 0.03s
- Ativa sprite com `flashLensFlare(sprite, position, intensity * caliberScale)`
- `decayLensFlare(sprite, dt, 3)` auto-fade no loop
- Pool cycling: mantém índice circular para reutilizar sprites

## 4. Substituir GroundFog (linhas 1439-1497)
Substituir o GroundFog simplificado por componente que usa a mesma API do `createVolumetricFogPlane` do render_ultra, mas inline em React Three Fiber:
- Shader com FBM 4-octave (copy do `volumetricFog.ts`)
- Uniforms: `uTime`, `uIntensity` (ligado a `groundFogIntensity`), `uHeight` (15), `uFogColor`
- Height-based density com edge fade

## 5. Upgrade FinaleDarkGround near-field (linhas 1573-1580)
- Substituir `meshStandardMaterial` por `meshPhysicalMaterial`
- Props: roughness 0.2, metalness 0.15, clearcoat 1.0, clearcoatRoughness 0.1
- Simula wet-asphalt do `terrainPBR.ts` preset

## 6. Sky Scatter de Explosões (SkyGradient shader, ~linha 906)
- Adicionar 2 uniforms ao sky shader: `uExplosionScatter` (vec3) e `uScatterIntensity` (float)
- No fragment shader final, antes do `gl_FragColor`: `color += uExplosionScatter * uScatterIntensity * exp(-abs(h) * 3.0);`
- Atualizar uniforms no `AdaptiveExposureController` quando há explosões ativas
- Decay: `uScatterIntensity *= max(0, 1 - dt * 3)`

## 7. Burst Simulation Configs no FireworkBurst (linhas 403-404)
- Chamar `getBurstConfig(pattern as BurstPattern)` no useMemo
- Usar `burstConfig.gravityMult` como multiplicador no GRAVITY do update loop
- Usar `burstConfig.tailFactor` como multiplicador na trail opacity

## 8. Refinamentos Visuais
- **Trail opacity** (linha 543): `opacity={0.6}` → `opacity={0.8}`
- **Star inner glow** (linha 194): `inner * 0.6` → `inner * 0.7`
- **AtmosphericParticles count** (linha 1329): `500` → `200`
- **AtmosphericParticles opacity** (linha 1377): `0.18` → `0.08`
- **FloorLogo opacity** (linha 1431): `0.35` → `0.15`

## 9. Wiring no Canvas (linhas 2289-2298)
Adicionar após `<GroundReflections />`:
```tsx
<SmokeController />
<LensFlareController />
```

## Resultado
Todos os 12 sistemas render_ultra ativados. Fumaça volumétrica pós-burst com vento, lens flares cinematográficos, ground fog FBM 4-octave, terrain PBR clearcoat, burst patterns calibrados, sky scatter dinâmico.

