

# Plano: Engine Turbo — Otimizações de Renderização AAA

## Objetivo
Trazer técnicas de engines profissionais (UE5/Unity HDRP) para maximizar FPS e reduzir draw calls no viewport 3D, sem perder qualidade visual.

## Otimizações a implementar

### 1. Render-on-Demand + Frame Budget Controller
Atualmente o `useFrame` roda a **60 FPS constante** mesmo com a cena parada. Implementar:
- **Invalidate-on-demand**: quando nada muda (sem playback, sem drag, sem animação), reduzir para ~4 FPS idle
- **Frame Budget**: se o frame demorar >16ms, reduzir automaticamente efeitos não-críticos no próximo frame (skip atmospheric particles, reduce bloom passes)

**Arquivo**: `SkyCanvas.tsx` — adicionar prop `frameloop="demand"` no Canvas e um `FrameBudgetController` que monitora `gl.info` e `performance.now()`

### 2. Frustum Culling Inteligente para Efeitos
Os efeitos pyro atualmente são todos renderizados. Implementar:
- **Spatial hash** para agrupar efeitos por setor do grid
- Skip `useFrame` de efeitos fora do frustum da câmera (sem criar/destruir geometria)

**Arquivo**: Novo `src/lib/spatialCuller.ts` — função `isInFrustum(camera, position, radius)` usada dentro de `TimelineEffects`

### 3. LOD Adaptativo Baseado em Frame Rate
O LOD atual é só por distância. Adicionar **LOD dinâmico por performance**:
- Se FPS < 30 por 500ms, descer 1 tier automaticamente
- Se FPS > 55 por 2s, subir 1 tier
- Feedback visual no Debug Overlay ("AUTO LOD: HIGH → MEDIUM")

**Arquivo**: `src/hooks/useLOD.ts` — novo `useAdaptiveLOD()` que combina distância + FPS

### 4. Geometry Merging para Elementos Estáticos
Ground, grid, e elementos fixos da cena geram draw calls separados. Implementar:
- Merge do ground + grid em um único draw call usando `BufferGeometryUtils.mergeGeometries`
- Lazy-create: só criar geometrias quando entram no viewport

**Arquivo**: `SkyCanvas.tsx` — refatorar `StageGround` para usar geometria merged

### 5. PostProcessing Condicional
As 3 camadas de Bloom + SMAA + Vignette + ChromaticAberration rodam sempre. Implementar:
- Skip bloom layers 2 e 3 quando não há explosões ativas
- Desabilitar ChromaticAberration e FilmGrain no modo Performance
- Half-resolution bloom (já usa `mipmapBlur`, mas adicionar downsampling explícito)

**Arquivo**: `PostProcessing.tsx` — receber prop `activeBursts` e condicionalmente renderizar layers

### 6. Object Pooling para Partículas
Efeitos pyro criam/destroem geometria a cada explosão (GC pressure). Implementar:
- Pool de `BufferGeometry` reutilizáveis para shells
- Reset de atributos em vez de `new Float32Array`

**Arquivo**: Novo `src/lib/geometryPool.ts`

## Resumo de impacto esperado

```text
┌───────────────────────────┬──────────┬──────────┐
│ Otimização                │ FPS Gain │ GPU Save │
├───────────────────────────┼──────────┼──────────┤
│ Render-on-demand (idle)   │ ∞ (idle) │ ~95%     │
│ Frustum cull efeitos      │ +15-30%  │ ~20%     │
│ Adaptive LOD              │ +10-20%  │ ~15%     │
│ Geometry merge            │ +5%      │ ~10%     │
│ Conditional PostProcess   │ +10-15%  │ ~20%     │
│ Object pooling            │ +5-10%   │ GC ↓50%  │
└───────────────────────────┴──────────┴──────────┘
```

## Arquivos modificados/criados
- `src/components/editor/SkyCanvas.tsx` — frameloop demand, FrameBudgetController, geometry merge
- `src/components/editor/PostProcessing.tsx` — conditional bloom layers
- `src/hooks/useLOD.ts` — useAdaptiveLOD com feedback de FPS
- `src/lib/spatialCuller.ts` (novo) — frustum culling para efeitos
- `src/lib/geometryPool.ts` (novo) — pool de geometrias reutilizáveis

