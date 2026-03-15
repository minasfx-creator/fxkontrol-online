

# Plano: Integrar Tecnologias render_ultra Disponíveis no Motor 3D

## Diagnóstico

O projeto possui um módulo completo `src/render_ultra/` com **7 sistemas avançados já construídos** que **NÃO estão integrados** na cena 3D real (`SkyCanvas.tsx`):

1. **Adaptive Exposure** — auto-exposição de câmera que escurece durante explosões brilhantes
2. **Ground Reflections** — reflexos especulares "wet surface" que reagem às explosões
3. **Lens Flare** — flares de lente sprite-based para explosões
4. **Global Illumination** — iluminação indireta dinâmica de explosões (hemisphere light probes)
5. **Particle Chemistry** — cores químicas reais (Strontium, Barium, Copper, Sodium, etc.)
6. **GPU Spark Trails** — sistema de trilhas incandescentes com history buffer
7. **Drone Materials PBR** — materiais avançados com env map

Além disso, os problemas persistentes:
- **Lua** ainda em `[60, 55, -80]` com raio 3.5 (dentro da cena, não no céu)
- **Drone LED** `emissiveIntensity: 14` (cegante)
- **Bloom thresholds** muito baixos (0.4) capturando tudo
- **Linha fantasma** de drones/trails

## Alterações Planejadas

### 1. Integrar Adaptive Exposure no Render Loop
**Arquivo:** `src/components/editor/SkyCanvas.tsx`

- Criar componente `<AdaptiveExposureController>` dentro do Canvas
- Usa `useFrame` para contar explosões ativas e ajustar `gl.toneMappingExposure` em tempo real
- Import: `createExposureController`, `updateExposure`, `flashEvent` de `render_ultra/postprocessing/exposure`
- Quando um burst tem `progress < 0.05`, chama `flashEvent` → exposição abaixa automaticamente como câmera real

### 2. Integrar Ground Reflections Reativas
**Arquivo:** `src/components/editor/SkyCanvas.tsx` (StageGround)

- Criar componente `<ExplosionReflections>` que renderiza um plano translúcido sobre o chão
- Usa shader de `render_ultra/environment/reflections` com uniforms dinâmicos
- `uReflectionColor` e `uReflectionIntensity` atualizam em tempo real baseado nas explosões ativas
- Blending additivo sobre o ground existente

### 3. Integrar Lens Flares em Explosões
**Arquivo:** `src/components/editor/SkyCanvas.tsx` (FireworkBurst)

- Adicionar sprite de lens flare durante break flash (`progress < 0.1`)
- Usa `createLensFlareSprite` de `render_ultra/postprocessing/lensFlare`
- Flare acompanha posição do burst, fade com progress
- Starburst rays + core glow como lente de câmera real

### 4. Integrar Particle Chemistry no Color System
**Arquivo:** `src/components/editor/SkyCanvas.tsx` (FireworkBurst)

- Quando cor do efeito corresponde a um composto químico, usar `thermalColor` de `render_ultra/fireworks/particleChemistry`
- Mapear cores hex → compostos (vermelho → Strontium, verde → Barium, azul → Copper, amarelo → Sodium)
- Usar `temperature` e `emissionIntensity` do composto para ajustar HDR multiplier e tamanho das partículas
- Resultado: cores mais ricas e fisicamente corretas

### 5. Corrigir Lua — Posição Celeste Realista
**Arquivo:** `src/components/editor/SkyCanvas.tsx` (Moon, ~linha 981-1087)

- Posição: `[60, 55, -80]` → `[200, 350, -300]`
- Raio body: 3.5 → 12
- Halos/corona: escalar proporcionalmente
- PointLight: intensity 0.35 → 0.15, distance 350 → 800

### 6. Corrigir Drones — LED Balanceado
**Arquivo:** `src/components/editor/InstancedDroneSwarm.tsx`

- `emissiveIntensity`: 14 → **2.5**
- `toneMapped`: false → **true**
- Halo opacity: 0.16 → **0.05**
- Halo scale: `s * 1.8` → `s * 1.0`

### 7. Bloom Seletivo (Blender Glare Node)
**Arquivo:** `src/components/editor/PostProcessing.tsx`

- Layer 1 threshold: 0.4 → **0.75**, intensity: `str * 0.8` → `str * 0.5`
- Layer 2 threshold: 0.6 → **0.9**, intensity: `str * 0.4` → `str * 0.25`
- Layer 3 threshold: 0.8 → **1.1**
- Resultado: bloom exclusivamente em HDR pyro, não em drones

### 8. Remover Fantasmas de Drone
**Arquivo:** `src/components/editor/LightTrails.tsx`

- Guard: se posições são estáticas (sem delta entre frames) ou count = 0, retornar null

### 9. Pyro Flash e Star Shader — Escala Natural
**Arquivo:** `src/components/editor/SkyCanvas.tsx`

- `flashSize`: `1.5 + caliber * 1.8` → `0.6 + caliber * 0.8`
- Star `gl_PointSize` factor: `2200.0` → `1600.0`
- `toneMappingExposure`: `1.5` → `1.2`

## Arquivos Editados
1. `src/components/editor/SkyCanvas.tsx` — Moon, exposure controller, reflections, lens flares, chemistry, pyro scaling
2. `src/components/editor/InstancedDroneSwarm.tsx` — LED intensity fix
3. `src/components/editor/PostProcessing.tsx` — Bloom thresholds
4. `src/components/editor/LightTrails.tsx` — Ghost guard

## Resultado
Motor 3D com **adaptive exposure**, **ground reflections**, **lens flares**, **particle chemistry** integrados — tecnologias que já existiam no código mas nunca foram ativadas. Lua no céu, drones sem ofuscar, bloom seletivo.

