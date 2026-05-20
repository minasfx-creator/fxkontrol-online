# Otimização de Geometria 3D — FX KONTROL

Achados da investigação (não toque sem ler):

- **Drones em show real (`FireworkRenderer.tsx` linhas 1460–1801)**: cada drone renderiza como `<LightPoint>` individual (sprite additivo + drift Y + pulso 4Hz). Com 10k drones = 10k componentes React + 10k draw calls. **Esse é o gargalo real.**
- **`InstancedDroneSwarm.tsx`** já existe e usa `THREE.InstancedMesh`, mas só é consumido por `BoidsVisualizer` e `DroneChoreography` (telas auxiliares). Show playback NÃO usa.
- **`RenderStabilityController` NÃO existe** no repo (a pesquisa que você colou assumiu que existe). Vou criar do zero.
- **`DRACOLoader`/`KTX2Loader`/`MeshoptDecoder` não estão registrados** em lugar nenhum. Uploads do `user_library_assets` hoje vão como GLB cru. Adicionar decoders no client + script `gltf-transform` no upload é ganho imediato.
- `Show3DEngine` já tem disposal correto (memo M5), então só plugar novos sistemas sem leak.

## Rodada 1 — RenderStabilityController + Geometry Budget

Criar `src/render_ultra/stability/renderStabilityController.ts`:
- Singleton observador de `requestAnimationFrame` com janela móvel 60 frames (p50/p95/p99 ms).
- Tier autodegrade `cinema → balanced → eco` (reusar `renderQualityCaps()` já criado no `featureFlags.ts`).
- Triggers: p95 > 22ms por 60f → degradar; p95 < 14ms por 300f + tier não-cinema → tentar subir 1 nível.
- Hook `useRenderQualityTier()` para componentes lerem o tier corrente reativamente.
- API `geometryBudget.register({ id, triangles, textureBytes })` + `geometryBudget.report()` para validar uploads e cenas.
- Limites canônicos: `MAX_TRIANGLES_PER_ASSET=50_000`, `MAX_TEXTURE_DIM=2048`, `MAX_VRAM_SCENE_MB=512`.

Criar `docs/HARDENING_RENDER_ENGINE3D.md` com os limites acima + checklist de upload + receita Draco/KTX2.

Plugar chip `RENDER` na `GlobalSafetyBar` (ao lado do `BUDGET` ECS existente): mostra `cinema|balanced|eco · p95Xms`.

Testes: `renderStabilityController.spec.ts` — degradação, recuperação histerese, geometry budget overshoot.

## Rodada 2 — InstancedMesh para Drones em Show Playback

Criar `src/components/editor/skycanvas/InstancedDroneField.tsx`:
- 1 `<instancedMesh args={[geom, mat, MAX=10_000]}>` com geometria compartilhada (cone+body baixo-poly ~120 tris) ou Points + shader em `eco`.
- Atributos instanciados via `InstancedBufferAttribute`: `aColor` (vec3), `aPhase` (float p/ pulso), `aActive` (float 0/1).
- Material `MeshBasicMaterial` (additive blend) + `onBeforeCompile` injetando pulso 4Hz reaproveitando shader atual do `LightPoint`.
- Update por frame: 1 `setMatrixAt` + `instanceMatrix.needsUpdate=true`. Zero realloc, pool fixo, compaction soft (active=0 → escala 0).
- LOD: tier `eco` cai pra Points puros (BufferGeometry de vértices), `balanced/cinema` mantém instancedMesh com mesh.

Em `FireworkRenderer.tsx` (linhas 1775–1801):
- Coletar todos `items` de drone num único array.
- Trocar `items.map(... <LightPoint/>)` por `<InstancedDroneField items={droneItems} />`.
- Manter `LightPoint` como fallback path (flag `r_instanced_drones`, default ON).

Testes: `instancedDroneField.spec.ts` — N items vira 1 draw call; matrix update determinístico; eco vira Points.

## Rodada 3 — Pipeline gltf-transform (Draco + KTX2 + LOD)

**Client (descompressão)**:
- `src/render_ultra/loaders/optimizedGLTFLoader.ts`: `GLTFLoader` + `DRACOLoader` (`/draco/`) + `KTX2Loader` (`/basis/`) + `MeshoptDecoder`.
- Servir `public/draco/` e `public/basis/` (copiar `three/examples/jsm/libs/draco/*` e `basis/*` no build).
- Substituir todos `useGLTF` da library por hook `useOptimizedGLTF` que registra triângulos+textureBytes no `geometryBudget` (rodada 1).

**Edge Function `optimize-library-asset`**:
- Recebe `{ asset_id }`, baixa do bucket `assets`, roda pipeline via npm `@gltf-transform/core` + `@gltf-transform/functions`:
  - `dedup()` → `prune()` → `weld()` → `simplify({ ratio: 0.6, error: 0.001 })` para LOD1+LOD2.
  - `draco({ method: 'edgebreaker' })` em mesh data.
  - `textureCompress({ targetFormat: 'ktx2', quality: 'uastc' })` (substituir imagens >512px).
- Salva `<asset>.optimized.glb` no bucket, adiciona colunas `optimized_url`, `original_bytes`, `optimized_bytes`, `triangle_count`, `vram_estimate_bytes` em `user_library_assets` (migração separada).
- `useOptimizedGLTF` prefere `optimized_url` quando disponível, cai pro original com warning.

**UI**: chip "Optimized · 87% smaller · 12k tris" no `LibraryAssetCard` (Rodada 2 anterior).

Testes: `optimizedGLTFLoader.spec.ts` — registro no budget; edge function dry-run via mock.

## Ordem de entrega

1. Rodada 1 (stability + budget + HARDENING doc) — base para as outras
2. Rodada 2 (InstancedDroneField) — ganho visível imediato em show
3. Rodada 3 (pipeline gltf-transform) — DB migration + edge function + client

## Não-objetos

- Não tocar em `uiCommandGateway`, `SafetyStateMachine`, `CommandBus`, `FieldBus`, FireOne, XL4, FXK-M1, Modbus, `moduleAggregator`, `FireOneModulesInline`.
- Não trocar versões de Three/R3F/Drei (já em 0.169/8.18/9.122).
- Não alterar `LightPoint` em outros caminhos (sprites de cue, efeitos isolados) — só substituir o map de drones em show.

## Aprovação

Posso começar pela Rodada 1 (stability + budget + doc), entregar, validar build, e seguir Rodada 2 e 3 em mensagens separadas — ou ir nas 3 em sequência. Sua escolha.
