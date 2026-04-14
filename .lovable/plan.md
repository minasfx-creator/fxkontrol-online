

# Camada 10: WebGPU Native Pipeline — Device, Buffers, Ping-Pong, Render Passes

## Objetivo
Criar a infraestrutura WebGPU nativa completa (device, buffers, bind groups, pipelines, render passes) como módulos independentes em `src/render_ultra/gpgpu/`, integrando-os com o sistema existente `GPUComputeParticleSystem`. Isso substitui o fallback Three.js DataTexture por um pipeline WebGPU real com ping-pong buffers, billboard rendering nativo, e blend states corretos para fogo (aditivo) e fumaça (alpha).

---

## Arquivos a Criar

### 1. `src/render_ultra/gpgpu/webgpuDevice.ts`
- `initWebGPU(canvas)`: adapter request, device creation, context configuration
- `premultiplied` alpha mode, preferred canvas format
- Device-lost handler com re-init automático
- Exporta `WebGPUContext` interface: `{ device, context, format, canvas }`

### 2. `src/render_ultra/gpgpu/webgpuBuffers.ts`
- `createParticleBuffers(device, count)`: ping-pong pair (STORAGE | VERTEX | COPY_DST), 64 bytes/particle
- `createSimUniformBuffer(device)`: 64-byte uniform
- `createSortUniformBuffer(device)`: 16-byte uniform
- `ParticlePingPong` class: `current`/`next` refs + `swap()` method

### 3. `src/render_ultra/gpgpu/webgpuBindGroups.ts`
- `createComputeBindGroup(device, layout, uniformBuf, particleBuf)`
- `createSortBindGroup(device, layout, particleBuf, sortUniformBuf)`
- `createRenderBindGroup(device, layout, uniformBuf)` for camera/projection uniforms

### 4. `src/render_ultra/gpgpu/webgpuPipelines.ts`
- `createComputePipeline(device, wgslCode)`: layout auto, entry `cs_update`
- `createFireRenderPipeline(device, format, wgslCode)`: vertex+fragment, additive blend (`one/one`), billboard quad
- `createSmokeRenderPipeline(device, format, wgslCode)`: alpha blend (`src-alpha/one-minus-src-alpha`)
- Vertex buffer layout: stride 64, locations for pos(float32x4), vel(float32x4), color(float32x4), misc(float32x4)

### 5. `src/render_ultra/gpgpu/webgpuPasses.ts`
- `runComputePass(encoder, pipeline, bindGroup, count)`: dispatch `ceil(count/256)` workgroups
- `runFireRenderPass(encoder, view, pipeline, bindGroup, vertexBuf, count)`: draw 6 vertices × count instances, clear on first pass
- `runSmokeRenderPass(encoder, view, pipeline, bindGroup, vertexBuf, count)`: same but load (no clear)

### 6. `src/render_ultra/gpgpu/webgpuLoop.ts`
- `WebGPUParticleLoop` class: orchestrates the full frame
  - Compute pass (physics)
  - Ping-pong swap
  - Fire render pass (additive)
  - Smoke render pass (alpha blend, load existing)
  - Integrates with existing `GPUComputeParticleSystem` for particle data
- Render shaders (WGSL): billboard vertex shader (camera-facing quads from particle data) + fire/smoke fragment shaders (blackbody + density)
- `requestAnimationFrame` loop with dt capping

### 7. `src/render_ultra/gpgpu/index.ts`
- Re-export all public APIs from the gpgpu modules

## Arquivos a Modificar

### 8. `src/render_ultra/fireworks/gpuComputeParticles.ts`
- Add `getComputeWGSL()` and `getSortWGSL()` static methods to expose shader strings for native pipeline use
- Add method `writeToGPUBuffer(device, buffer)` to pack SoA → packed buffer directly

### 9. `src/render_ultra/index.ts`
- Export new gpgpu module APIs

## Detalhes Técnicos

```text
Frame Pipeline (WebGPU Native):

SimParams → Uniform Buffer (64B)
                ↓
Particle Buffer A (read) → Compute Pass → Particle Buffer B (write)
                                              ↓
                                         swap(A, B)
                                              ↓
                              Buffer B → Fire Render Pass (additive blend, clear)
                                              ↓
                              Buffer B → Smoke Render Pass (alpha blend, load)
                                              ↓
                                         Present to canvas
```

- Billboard quads generated in vertex shader (6 verts per instance, no index buffer)
- Particle type field (`misc.w`) used to route fire vs smoke in fragment shader
- Ping-pong eliminates read-write hazards without barriers
- All buffers pre-allocated, zero GC in frame loop
- CPU fallback path in `GPUComputeParticleSystem` unchanged — this is a parallel GPU-native path
- `ParticleGPGPU.ts` (WebGL DataTexture approach) remains as legacy fallback

