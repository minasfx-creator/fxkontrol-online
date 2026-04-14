

# Camada 11: Render Volumétrico Real — Curl Noise Smoke, ACES Tonemapping, Light Scattering

## Objetivo

Upgrade os shaders de render e compute existentes no pipeline WebGPU nativo (`src/render_ultra/gpgpu/`) com: (1) smoke compute dedicado com curl noise divergence-free, (2) fragment shaders cinematográficos com ACES tonemapping, (3) light scattering pass, (4) billboard instanciado via storage buffer read. Tudo incremental sobre a Camada 10 existente.

---

## Arquivos a Criar

### 1. `src/render_ultra/gpgpu/wgsl/smokeCompute.wgsl.ts`
Exporta string WGSL do compute shader de fumaça com:
- `SmokeSimParams` uniform (dt, time, wind, turbulence, dissipation, rise_force)
- `SmokeParticle` struct (pos, vel, density)
- `curl_noise()`: derivadas cruzadas de 3D value noise → campo divergence-free
- `cs_smoke_update`: advecção com curl noise, rise force, drag racional, dissipação de densidade
- Workgroup size 256

### 2. `src/render_ultra/gpgpu/wgsl/renderShaders.wgsl.ts`
Substitui o `RENDER_WGSL` inline no `webgpuLoop.ts`. Exporta shader completo com:
- **Billboard vertex** com particle read via `var<storage, read>` (instancing nativo, sem vertex buffer layout)
- **Fire fragment**: núcleo emissivo `exp(-r²*7)` + halo `exp(-r²*1.8)*0.35`, blackbody tint por temperatura, ACES tonemapping no output
- **Smoke fragment**: Beer-Lambert absorption, densidade variável por `misc.z`, cor base escura com aquecimento por proximidade de fogo
- **ACES helper**: `fn aces_tonemap(x: vec3<f32>) -> vec3<f32>` — Narkowicz fit

### 3. `src/render_ultra/gpgpu/wgsl/lightScatter.wgsl.ts`
Exporta WGSL para um fullscreen-triangle pass de light scattering:
- `LightScatterParams` uniform (intensity, falloff, radius, time, light positions)
- Fragment shader que amostra radial falloff `1/(1 + k*d²)` de cada fonte de luz
- Output aditivo baixa intensidade para aquecer bordas de fumaça

### 4. `src/render_ultra/gpgpu/webgpuLightScatter.ts`
Pipeline e pass de light scattering:
- `createLightScatterPipeline(device, format, wgslCode)`: fullscreen triangle, additive blend leve
- `createLightScatterUniform(device)`: buffer para parâmetros + posições de luz
- `runLightScatterPass(encoder, view, pipeline, bindGroup)`: draw(3) fullscreen

---

## Arquivos a Modificar

### 5. `src/render_ultra/gpgpu/webgpuLoop.ts`
- Importar shaders de `wgsl/renderShaders.wgsl.ts` em vez do `RENDER_WGSL` inline
- Adicionar smoke compute pipeline e bind groups separados
- Adicionar light scatter pass após smoke render
- Frame pipeline atualizado:
  ```
  Compute Physics → Compute Smoke → Sort → Fire Render → Smoke Render → Light Scatter → Present
  ```
- Novo campo `smokeComputePipeline`, `lightScatterPipeline` e bind groups correspondentes

### 6. `src/render_ultra/gpgpu/webgpuPipelines.ts`
- Adicionar `createSmokeComputePipeline(device, wgslCode)` com entry `cs_smoke_update`
- Exportar nova factory

### 7. `src/render_ultra/gpgpu/webgpuPasses.ts`
- Adicionar `runSmokeComputePass(encoder, pipeline, bindGroup, count)`
- Adicionar `runLightScatterPass(encoder, view, pipeline, bindGroup)`

### 8. `src/render_ultra/gpgpu/webgpuBuffers.ts`
- Adicionar `createSmokeUniformBuffer(device)` (32 bytes)
- Adicionar `createLightScatterUniformBuffer(device)` (64 bytes)
- Exportar constantes `SMOKE_UNIFORM_BYTES`, `LIGHT_SCATTER_UNIFORM_BYTES`

### 9. `src/render_ultra/gpgpu/webgpuBindGroups.ts`
- Adicionar `createSmokeComputeBindGroup(device, layout, uniformBuf, smokeBuf)`
- Adicionar `createLightScatterBindGroup(device, layout, uniformBuf)`

### 10. `src/render_ultra/gpgpu/index.ts`
- Re-exportar novos módulos e types

---

## Detalhes Técnicos

```text
Frame Pipeline Atualizado:

SimParams ──→ Compute Physics (particles)
SmokeParams ──→ Compute Smoke (curl noise advection)
                    ↓
              Bitonic Sort (transparency ordering)
                    ↓
              Fire Render Pass (additive, clear, ACES in fragment)
                    ↓
              Smoke Render Pass (alpha blend, load, Beer-Lambert)
                    ↓
              Light Scatter Pass (fullscreen, additive low-intensity)
                    ↓
              Present
```

- ACES tonemapping aplicado **dentro** do fire fragment shader (preserva HDR até o último momento)
- Curl noise é divergence-free por construção (derivadas cruzadas), garantindo turbulência sem explosão de volume
- Light scatter usa fullscreen triangle (3 vertices, no index buffer) para evitar overhead de quad
- Smoke compute separado do physics principal para permitir tuning independente de turbulência vs física
- Todos os novos buffers pré-alocados no constructor, zero GC no hot path
- CPU fallback path inalterado — todo código novo é WebGPU-only com guard `if (!navigator.gpu)`

