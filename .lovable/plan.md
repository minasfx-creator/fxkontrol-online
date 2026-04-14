

# WGSL Raymarch Volumétrico — Plano de Integração

## Situação Atual

O pipeline volumétrico existente em `src/render_ultra/volumetric/` opera inteiramente via **THREE.js WebGL** (Layer 4: `RaymarchRenderer.ts` usa `THREE.ShaderMaterial` com GLSL, `THREE.Data3DTexture`, e `THREE.BoxGeometry`). A simulação (Layer 3) roda na **CPU** com advecção semi-Lagrangiana e curl noise.

O shader WGSL fornecido é um **raymarch nativo WebGPU** com fullscreen quad, ray reconstruction via `inv_view_proj`, e ACES integrado — incompatível com o renderer THREE.js atual mas complementar como upgrade de GPU nativa.

## O que será criado

### 1. Shader WGSL — `src/render_ultra/volumetric/shaders/fxk_voxel_raymarch.wgsl.ts`

Exportar o shader como string TypeScript (padrão do projeto — sem suporte a import de `.wgsl` no Vite sem plugin). Inclui vertex fullscreen quad + fragment raymarch + ACES tonemap.

### 2. WebGPU Raymarch Pipeline — `src/render_ultra/volumetric/WebGPURaymarchPipeline.ts`

Classe que encapsula:
- Criação do `GPURenderPipeline` com o shader WGSL
- Uniform buffers para `Camera` (inv_view_proj, position) e `VolumeParams` (step_size, density_scale, absorption, scattering, anisotropy, etc.)
- `GPUTexture` 3D (`r32float` ou `rgba8unorm`) criada a partir do `VoxelGrid.textureData`
- `GPUSampler` linear
- Bind group layout com 4 bindings (camera uniform, params uniform, texture 3D, sampler)
- Método `uploadGrid(grid: VoxelGrid)` — escreve `packTextureData()` no `GPUTexture` via `writeTexture`
- Método `render(encoder: GPUCommandEncoder, targetView: GPUTextureView, camera: Camera)` — executa o render pass fullscreen
- Método `updateParams(params: Partial<VolumeParams>)` — atualiza uniforms
- Método `dispose()` — limpa recursos GPU

Alinhamento WGSL dos structs:
- `Camera`: 3× mat4x4 (192B) + vec4 position (16B) = **208 bytes**, alinhado a 16
- `VolumeParams`: 2× f32 + i32 + 5× f32 + f32 pad = **32 bytes**, alinhado a 16

### 3. Integração no VolumetricCompositor — `VolumetricCompositor.ts`

Adicionar detecção de WebGPU no construtor:
- Se `navigator.gpu` disponível e adapter/device obtidos → criar `WebGPURaymarchPipeline`
- Senão → manter o renderer THREE.js GLSL existente (fallback automático, zero breaking changes)

No método `update()`, volumes com `useFallback === false` e WebGPU disponível usam o pipeline WGSL; caso contrário, continuam com `RaymarchRenderer.ts`.

### 4. React Hook — `src/hooks/useWebGPUDevice.ts`

Hook reutilizável que:
- Requisita adapter + device uma única vez
- Retorna `{ device, format, supported }` 
- Trata `device.lost` com re-init
- Memoiza para evitar múltiplas requisições

### 5. Atualização do VoxelVolumetricEffect — `VoxelVolumetricEffect.tsx`

Passar o `GPUDevice` (se disponível) ao `VolumetricCompositor` para que ele possa criar o pipeline WGSL. Nenhuma mudança na API pública do componente.

## Arquivos

| Arquivo | Ação |
|---------|------|
| `src/render_ultra/volumetric/shaders/fxk_voxel_raymarch.wgsl.ts` | Criar — shader WGSL como string |
| `src/render_ultra/volumetric/WebGPURaymarchPipeline.ts` | Criar — pipeline WebGPU completo |
| `src/hooks/useWebGPUDevice.ts` | Criar — hook de inicialização GPU |
| `src/render_ultra/volumetric/VolumetricCompositor.ts` | Editar — adicionar path WebGPU com fallback |
| `src/components/editor/effects/VoxelVolumetricEffect.tsx` | Editar — injetar device GPU opcional |
| `src/render_ultra/volumetric/index.ts` | Editar — exportar novos módulos |
| `src/render_ultra/index.ts` | Editar — re-exportar WebGPU pipeline |

## Regras de Segurança

- O renderer GLSL (`RaymarchRenderer.ts`) permanece **intacto** — é o fallback
- `VolumetricCompositor` decide em runtime qual path usar
- Nenhuma alteração em timeline, sync, core determinístico ou stores
- Se WebGPU falhar em qualquer ponto (adapter null, device lost, pipeline error), o sistema degrada para GLSL automaticamente

## Detalhes Técnicos — Struct Alignment

```text
Camera (WGSL uniform):
  offset  0: view        mat4x4<f32>  64B  align 16
  offset 64: proj         mat4x4<f32>  64B  align 16
  offset128: inv_view_proj mat4x4<f32> 64B  align 16
  offset192: position     vec4<f32>    16B  align 16
  total: 208 bytes

VolumeParams (WGSL uniform):
  offset 0: step_size     f32   4B
  offset 4: max_steps     i32   4B
  offset 8: density_scale f32   4B
  offset12: emission_scale f32  4B
  offset16: absorption    f32   4B
  offset20: scattering    f32   4B
  offset24: anisotropy    f32   4B
  offset28: pad           f32   4B
  total: 32 bytes
```

TypeScript writers usarão `Float32Array` + `Int32Array` view no offset correto para garantir match byte-a-byte.

