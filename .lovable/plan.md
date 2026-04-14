

## Camada 7: Cinema-Grade Shaders — Fire, Smoke & Burst

### Objetivo
Implementar 3 shaders GLSL de produção cinematográfica integrados ao pipeline existente de `ShaderMaterial` do Three.js, substituindo as aproximações visuais atuais por modelos fisicamente motivados.

> **Nota**: WebGPU/WGSL não está disponível no sandbox de preview. Os shaders serão escritos em GLSL (compatível com WebGL2 via Three.js) seguindo a mesma arquitetura já estabelecida em `softParticleShader.ts` e `instancedParticleRenderer.ts`. A lógica matemática dos shaders WGSL fornecidos será portada fielmente.

---

### Arquivos a Criar

**1. `src/render_ultra/fireworks/cinemaFireShader.ts`**
- Vertex + Fragment GLSL para partículas de fogo/faísca
- Blackbody temperature→color no fragment (portando a função fornecida)
- Temporal flicker via `sin(time * 20 + seed * 10)` com modulação orgânica
- Decaimento exponencial de energia (`exp(-2.0 * lifeRatio)`)
- HDR emission multiplier (×10) para alimentar o bloom pipeline
- Factory function `createCinemaFireMaterial()` retornando `THREE.ShaderMaterial`
- Uniforms: `uTime`, `uHDRMultiplier`, `uFlickerIntensity`
- Attributes per-instance: `aTemperature`, `aLife`, `aMaxLife`, `aSeed`

**2. `src/render_ultra/fireworks/cinemaSmokeShadeer.ts`**
- Fragment GLSL com fake-volumetric smoke via FBM (4 octaves)
- Depth-fade soft particle (reutilizando padrão de `softParticleShader.ts`)
- Turbulence advection via time-offset no domínio do noise
- Density-controlled alpha com `smoothstep(0.2, 0.7, density)`
- Factory `createCinemaSmokeMaterial()` com uniforms: `uTime`, `uDensityScale`, `uDepthTexture`, `uSoftness`

**3. `src/render_ultra/fireworks/cinemaBurstShader.ts`**
- Fragment GLSL para explosões multi-camada
- Core radial falloff (`exp(-3r)`) + onda de choque (`sin(dist*20 - time*10)`)
- HDR glow (×5) para bloom intenso no frame de impacto
- Alpha fadeout radial via `smoothstep`
- Factory `createCinemaBurstMaterial()` com uniforms: `uTime`, `uCoreIntensity`, `uWaveSpeed`

### Arquivos a Modificar

**4. `src/render_ultra/index.ts`**
- Exportar as 3 factory functions e tipos dos novos shaders

**5. `src/render_ultra/fireworks/instancedParticleRenderer.ts`**
- Adicionar método `setShaderMode(mode: 'default' | 'cinema-fire' | 'cinema-smoke' | 'cinema-burst')` que troca o material interno
- Quando `cinema-fire`, injetar os attributes extras (`aTemperature`, `aLife`, etc.)

**6. `src/components/editor/effects/SparkShower.tsx`**
- Quando feature flag `cinematic_camera_response` ativo, usar `createCinemaFireMaterial()` em vez do `pointsMaterial` básico

### Detalhes Técnicos

```text
Pipeline Integration:

Particle Data (CPU)
    ↓ per-instance buffers
Cinema Shader (GPU fragment)
    ↓ HDR output (values > 1.0)
Bloom Pass (existing EffectComposer)
    ↓ threshold + gaussian
ACES Tone Map (Camada 5)
    ↓ hue-preserve
Final Output
```

- Todos os shaders usam `THREE.AdditiveBlending` para fire/burst e `THREE.NormalBlending` para smoke
- `depthWrite: false` em fire/burst, `depthWrite: false` + soft depth-fade em smoke
- Zero alocações no hot path — uniforms atualizados via `.value =`
- FBM limitado a 4 iterações conforme diretriz de performance

