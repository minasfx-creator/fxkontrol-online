# Plano — Realismo de Fogos + Library 3D

## 0. Confirmação de escopo

- **Build**: nada a fazer. O `vite.config.ts` atual não importa os 3 plugins citados (`precache-guard`, `bundle-budget`, `sitemap`) e o dev-server não loga erro. Pulado conforme sua resposta.
- **FireOne / XL4 / FXK-M1 / Modbus / moduleAggregator / FireOneModulesInline**: preservados como estão. Tocaremos só renderer e Library. Zero mudança em safety, hardware ou comando.
- **Target GPU**: GTX 1660+. Novo flag `fxk.flag.render_quality` (`cinema` | `balanced` | `eco`) com **default `cinema`** no perfil alvo, auto-degrada em iGPU detectada via `WEBGL_debug_renderer_info`.

---

## 1. Fogos — pipeline cinematográfico

Trabalho concentrado em `src/components/editor/skycanvas/FireworkRenderer.tsx`, `src/render_ultra/fireworks/*` e shaders existentes (`cinemaBurstShader`, `cinemaSmokeShader`, `sparkTrailsGPU`, `ribbonTrailRenderer`, `softParticleShader`). Tudo opt-in via flags já reservadas na memória (`r_silhouette_all`, `r_soft_particles`, `r_hdr_ember_tail`, `r_lightprobe_from_bursts`) — agora promovidas a ON no perfil `cinema`.

### 1.1 Trails + sparks secundárias (prioridade que você marcou)
- Cometas do `BurstSimulation` ganham **ribbon trail** GPU (`ribbonTrailRenderer`) com largura modulada por velocidade (1.4→0.2 px) e cor herdada do blackbody T (branco quente → âmbar → carmim).
- **Child sparks**: cada partícula primária com `lifeRatio>0.55 && Math.random()<spawnRate` emite 2–4 sparks pequenos via pool pré-alocado (zero-GC, reaproveita slots livres no `ParticlePool`). Sparks usam `additive` blending e decay 220 ms.
- Decay térmico: novo helper `thermalGradient(T)` reusando Planckian Locus já presente em `cinemaBurstShader` — agora aplicado também aos trails e sparks.

### 1.2 Smoke + wind physics
- Pluma volumétrica pós-burst: ativa `smokeSimulation.ts` + `computeSmokeTurbulence.ts` com **curl noise 3D** (já existe, hoje desligado no FireworkRenderer). Spawn = 1 puff por burst principal, sigma 1.8 m, lifespan 4–6 s, drag exponencial `exp(-1.21·dt)`, buoyancy proporcional ao `lifeRatio` (memória `r3-pass2-skybrush-smoke`).
- Wind sample reaproveita `WindFieldSystem` já consumido em `BallisticSolver`. Adiciono `windSystem` opcional ao path de smoke (hoje só partículas o consomem).
- Soft-particles ON (`softParticleShader.ts`) para evitar hard-edges contra terreno e palco.

### 1.3 HDR + post-processing
- Garantir que `Show3DEngine` rode com `WebGLRenderer({ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping })`. Hoje está parcial.
- Habilitar EffectComposer com:
  - **Bloom anamórfico** (`@react-three/postprocessing` já no bundle `postprocessing`) — threshold 0.9, intensity 1.2 cinema / 0.7 balanced.
  - **Halation laranja** (`halation.ts` em `render_ultra/postprocessing/`).
  - **Lens flare** procedural (`lensFlare.ts`) — só na partícula mais brilhante por burst, custo O(N_bursts).
  - **ACES hue-preserving highlight** (`acesHuePreserve.ts`).
- Tudo já existe em `src/render_ultra/postprocessing/*` mas nunca foi montado — vou plugar no `FireworkRenderer` atrás da flag `cinema`.

### 1.4 Performance
- Hard caps por perfil:
  - `cinema`: 24 bursts simultâneos, 6k partículas, smoke ON, post-FX completo.
  - `balanced`: 16 / 3k / smoke ON / só bloom+halation.
  - `eco`: 10 / 1.5k / sem smoke / sem post-FX.
- Auto-degrade quando p95 frame > 22 ms por 60 frames consecutivos (já temos `useFrameBudget`).
- Sem regressões nos contratos: `cueFlash`, `renderFrame` continuam idênticos.

### 1.5 Tests
- `firework-realism-pass1.spec.ts` ampliado para pass 2: cobre spawn de sparks, lifecycle de smoke puff, ribbon vertex count, caps por perfil.
- Manter os 5/5 testes verdes existentes.

---

## 2. Library de Assets (todas as 3 opções que você escolheu)

Trabalho em `useMyLibrary.ts` + `AssetMarketplaceBrowser.tsx` (UI) + novo `LibraryDrawer.tsx`.

### 2.1 Preview 3D inline
- Mini `<Canvas>` R3F dentro de cada card de asset 3D (.glb/.gltf/.fbx). Auto-rotate 8 s/volta, OrbitControls desabilitado, fundo Vantablack, key+rim lights.
- Loader: `useGLTF` com Suspense + skeleton. Dispose on unmount (`useEffect` cleanup) — sem leak (memória `M5 Three Disposal`).
- Thumb estática (já existe `thumbnail_base64`) usada como `<img>` fallback até o GLB carregar.

### 2.2 Busca + categorias + tags
- Nova tabela `user_library_assets` ganha colunas: `category text` (`prop` | `texture` | `particle` | `model3d` | `audio` | `other`), `description text`, e índice GIN em `tags`.
- UI ganha barra de busca textual (case-insensitive, full-text local com `Array.filter`), filtro multi-tag (chips), e tabs por categoria.
- Migração Supabase com RLS preservada (owner-only).

### 2.3 Drag-and-drop pro viewport
- Card vira `draggable` com `dataTransfer.setData('application/x-fxk-asset', JSON.stringify({id,name,category,file_path}))`.
- `Show3DEngine` host (`SkyCanvas` / `ShowEngineHost`) ganha `onDragOver` + `onDrop` handlers. Drop em prop/model3d:
  - Resolve URL signed do bucket `assets`.
  - Raycast XZ no terreno (memória `Terrain Sync`) → posiciona objeto.
  - Adiciona a `useProjectStore` como `SceneObject` com source `library:<asset.id>`.
- Audio/texture/particle: drop no painel correspondente (não no viewport), com guard de tipo.

### 2.4 Upload melhorado
- Botão "Adicionar" abre dialog com:
  - Drop-zone (drag&drop também na entrada).
  - Captura automática de thumb: para `.glb` renderiza off-screen R3F 256×256; para imagem usa `createImageBitmap` + canvas downscale.
  - Auto-detecta categoria por extensão.
- Progress bar real (Supabase Storage suporta via `XMLHttpRequest` wrapper).

---

## 3. Arquivos previstos

### Editar
- `src/components/editor/skycanvas/FireworkRenderer.tsx` — plug ribbon+sparks+smoke+post-FX, ler flag de qualidade.
- `src/render_ultra/fireworks/burstSimulation.ts` — emissão de child sparks, atomização do pool.
- `src/render_ultra/fireworks/smokeSimulation.ts` — aceitar `windSystem` injetado.
- `src/orchestration/EngineProvider.tsx` ou `Show3DEngine` host — montar EffectComposer.
- `src/hooks/useMyLibrary.ts` — novos campos (`category`, `description`), filtros, search.
- `src/components/editor/AssetMarketplaceBrowser.tsx` — preview 3D inline, busca, tags, drag handlers.
- `src/components/editor/skycanvas/SkyCanvas3D.tsx` (ou host equivalente) — drop handlers no viewport.
- `src/lib/featureFlags.ts` — registrar `render_quality` + promover flags `r_*` no perfil cinema.

### Criar
- `src/render_ultra/fireworks/sparkChildEmitter.ts` (helper puro).
- `src/render_ultra/postprocessing/fireworkComposer.ts` (composer factory por perfil).
- `src/components/editor/library/LibraryAssetCard.tsx` (card com preview 3D).
- `src/components/editor/library/LibrarySearchBar.tsx` (busca+filtros).
- `src/lib/libraryDragDrop.ts` (encode/decode payload + drop resolver).
- `src/__tests__/firework-realism-pass2.spec.ts`.
- `src/__tests__/libraryDragDrop.spec.ts`.

### Migração DB
```sql
ALTER TABLE public.user_library_assets
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS description text;
CREATE INDEX IF NOT EXISTS idx_user_library_assets_tags_gin
  ON public.user_library_assets USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_user_library_assets_category
  ON public.user_library_assets(category);
```
RLS existente (owner-only) é preservada.

---

## 4. Não-objetivos (explícitos)

- Nada de mudar safety/SSM/uiCommandGateway/CommandBus.
- Sem nova rota ou mudança em sidebar.
- Sem alteração em FireOne, XL4, FXK-M1, Modbus, moduleAggregator, FireOneModulesInline.
- Sem nova dependência npm (tudo já existe: `@react-three/postprocessing`, `@react-three/drei`, etc.).
- Sem rebuild do PWA cache strategy.

---

## 5. Ordem de execução

1. Migração DB (sem dependência de código).
2. Library — backend + UI + drag&drop (entrega independente, sem mexer em fogos).
3. Fogos — pipeline + flag + post-FX.
4. Testes pass-2 + atualização do guard E2E (manter 397 routed + nenhum regressão em `KNOWN_UNROUTED 33`).
5. Smoke test no `/dev/effects-e2e` e `/dev/skycanvas-2`.

Posso começar?
