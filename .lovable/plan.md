

# Camada 9: Pipeline Cinematográfico Completo — 7-Stage GPU Architecture + Recalibração Global

## Objetivo
Reestruturar o sistema de compute shaders em um pipeline de 7 estágios (Compute Physics → Compute Energy/Combustion → Compute Smoke Turbulence → Vertex Billboard → Fragment Emissive → Fragment Smoke → Post-bloom), recalibrando todos os valores de todas as camadas para funcionar como um sistema coeso de produção cinematográfica.

---

## Arquivos a Criar

### 1. `src/render_ultra/fireworks/computeCombustion.ts`
Compute kernel dedicado a combustão + energia (separado da física):
- Consumo de combustível exponencial (`energy -= burn * 0.6`)
- Flicker orgânico multi-harmônico injetado na energia (não apenas no fragment)
- Thermal radiation via Stefan-Boltzmann (dT/dt ∝ -T⁴)
- Clamp de energia para evitar negativos
- CPU fallback fiel ao WGSL

### 2. `src/render_ultra/fireworks/computeSmokeTurbulence.ts`
Compute kernel dedicado a advecção de fumaça via curl noise:
- Curl noise com gradientes centrais (eps = 0.1) para divergência zero
- Multi-octave turbulence (2 escalas: macro + micro)
- Buoyancy térmica para partículas de fumaça
- Dissipação progressiva por fase de vida
- CPU fallback

---

## Arquivos a Modificar

### 3. `src/render_ultra/fireworks/gpuComputeParticles.ts`
**Reestruturar** o tick em 3 dispatches separados:
1. Force accumulation (gravidade, drag, vento) — já existe, recalibrar valores
2. Combustion kernel (novo) — integrar `computeCombustion`
3. Smoke turbulence (novo) — integrar `computeSmokeTurbulence`
- Adicionar campo `energy` e `fuel` ao particle struct (96 bytes total)
- Recalibrar: drag coeff `0.5 * 1.225 → 0.5 * 1.18` (ar a 25°C), buoyancy `2.8 → 3.2`, turbulence `2.5 → 3.0`
- Sorting: manter bitonic sort existente

### 4. `src/render_ultra/fireworks/cinemaFireShader.ts`
Recalibrar fragment shader:
- HDR multiplier: `8.0 → 10.0` (peak mais intenso para bloom threshold 1.2)
- Flicker: adicionar 2 harmônicas extras (7 total) para micro-cintilação
- Energy decay: `exp(-2.5 * lr) → exp(-2.0 * lr)` (decaimento mais lento = trails mais longos)
- Thermal coupling: `1.8 → 1.5` (cooling mais gradual)
- Core white injection: estender de 15% → 20% da vida
- Ember phase: onset `0.6 → 0.55` (transição mais suave)

### 5. `src/render_ultra/fireworks/cinemaSmokeShader.ts`
Recalibrar fragment shader:
- Density scale: `1.4 → 1.6` (fumaça mais encorpada)
- Absorption: `0.85 → 0.92` (Beer-Lambert mais opaco)
- FBM: adicionar 5ª octave para micro-detalhe
- Scatter: `0.6 → 0.75` (rim light mais pronunciado)
- Wind advect: `1.0 → 1.3` (mais responsivo ao vento)
- Cor quente: `(0.28, 0.22, 0.18) → (0.32, 0.24, 0.16)` (mais amber perto do fogo)

### 6. `src/render_ultra/fireworks/cinemaBurstShader.ts`
Recalibrar fragment shader:
- Core intensity: `1.5 → 2.0` (flash mais intenso)
- HDR peak: `12.0 → 14.0` (bloom máximo no frame de impacto)
- Wave decay: `3.5 → 4.0` (shockwave mais rápida)
- Adicionar secondary flash: re-ignição a 30% da vida (debris catching fire)
- Sparkle threshold: `0.97 → 0.96` (mais debris brilhantes)

### 7. `src/render_ultra/fireworks/instancedParticleRenderer.ts`
- Adicionar cinema-smoke/burst per-instance attributes (`aLife`, `aMaxLife`, `aEnergy`)
- Método `writeCinemaSmokeData` e `writeCinemaBurstData` análogos ao fire
- Bridge com GPUComputeParticleSystem: método `writeFromComputeData(cpuData, camera)` que lê SoA e escreve nos buffers instanced

### 8. `src/render_ultra/index.ts`
- Exportar novos módulos de combustion e smoke turbulence

---

## Calibração Cross-System

```text
Pipeline calibrado end-to-end:

Fire Peak HDR: 10.0   ──→ Bloom threshold: 1.2 ──→ visible halo
Burst Peak HDR: 14.0  ──→ Bloom threshold: 1.2 ──→ intense flash
Smoke alpha: 0.75 max ──→ NormalBlend over fire  ──→ não mascara bloom
ACES toe: 0.0         ──→ preserva sombras       ──→ smoke stays dark
Film grain: 0.015     ──→ luminance-coupled       ──→ invisible on fire, visible on smoke
```

---

## Detalhes Técnicos

- Particle struct expandido para 96 bytes (adiciona `energy: f32`, `fuel: f32`, padding)
- Workgroup size mantido em 256 (optimal para GPUs mobile e desktop)
- CPU fallback para todos os novos kernels
- Zero alocações no hot path — todos os buffers pré-alocados
- WGSL alignment: `vec3<f32>` paddado a 16 bytes conforme spec

