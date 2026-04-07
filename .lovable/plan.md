

# Renderizacao, Efeitos Cinematicos e Correcao de Bugs — World Shows

## Bugs Criticos Identificados

### Bug 1: GPS Anchor nao sincroniza com Google 3D Tiles
O `VenueShowOverlay` chama `store.setGpsOrigin(preset.gps)` (project store) e `scene.updateSettings(preset.sceneOverrides)`, mas `sceneOverrides` NAO inclui `geoAnchorLat/Lon/Alt`. O Google Tiles le do scene store (`settings.geoAnchorLat`), entao os tiles nunca mudam de posicao. O `GeoLocationSetup` faz corretamente — chama `updateSettings({ geoAnchorLat, geoAnchorLon, geoAnchorAlt })` explicitamente.

### Bug 2: Camera nao voa para o local
O fluxo nao chama `triggerFlyTo()` apos selecionar a praca. O usuario ve o overlay AR mas a camera fica parada na posicao anterior. O `GeoLocationSetup` faz corretamente com `triggerFlyTo({ lat, lng, alt: 300, duration: 2.5, pitch: 45 })`.

### Bug 3: Camera altitude drop spam
Console mostra dezenas de `[Camera] altitude drop clamped` durante flyTo porque `clampToWorldBounds` nao ignora flyTo adequadamente. O guard `if (isFlyingTo()) return;` existe mas o flyTo nao e chamado, entao nao se aplica — quando corrigirmos o flyTo, este log spam pode aparecer se o timing da clamp vs flyTo nao estiver sincronizado.

### Bug 4: Performance — Watchdog degradation frequente
Logs mostram oscilacao `none → severe → none` frequente (FPS caindo para 21-29). O `traverse()` no GoogleTilesEngine percorre TODOS os meshes a cada frame para culling, criando GC pressure. 

## Solucoes

### 1. Fix VenueShowOverlay — Sincronizar geoAnchor + flyTo + orbit cinematico
**Arquivo**: `src/components/editor/VenueShowOverlay.tsx`

No `deploying` phase, ANTES de injetar positions/timeline:
- Chamar `scene.updateSettings({ geoAnchorLat: preset.gps.lat, geoAnchorLon: preset.gps.lng, geoAnchorAlt: 0, floatingOriginEnabled: true })` para mover os tiles
- Importar `triggerFlyTo` e `triggerOrbit` de `GeoCameraController`
- Na fase `reveal` (inicio), trigger `triggerFlyTo({ lat, lng, alt: 400, duration: 3, pitch: 35 })` para camera voar cinematicamente ao local
- Apos deploy completo (fase `dissolve`), iniciar `triggerOrbit([0, 0, 0], 300, 0.08, 250)` para sobrevoo lento — 8 segundos, depois `stopOrbit()`

### 2. Fix sceneOverrides nos presets
**Arquivo**: `src/data/worldShowPresets.ts`

Adicionar `geoAnchorLat`, `geoAnchorLon`, `geoAnchorAlt` ao tipo `sceneOverrides` e a cada preset. Isso garante que `scene.updateSettings(preset.sceneOverrides)` no overlay atualiza o anchor dos tiles.

Alternativa mais simples (preferida): em vez de modificar todos os 16+ presets, o `VenueShowOverlay` deve injetar `geoAnchorLat/Lon` diretamente no `updateSettings()` call, usando `preset.gps`.

### 3. Otimizar GoogleTilesEngine traverse
**Arquivo**: `src/core/geo/GoogleTilesEngine.tsx`

Reduzir frequencia do `traverse()` de 60fps para ~10fps (a cada 6 frames) usando um frame counter. O culling por distancia nao precisa rodar a cada frame — meshes nao se movem entre frames.

### 4. Sobrevoo cinematico automatico
**Arquivo**: `src/components/editor/VenueShowOverlay.tsx`

Sequencia temporal apos selecao:
```text
t=0ms      → triggerFlyTo (camera voa para posicao)
t=500ms    → VenueShowOverlay aparece com intel AR
t=3500ms   → Show deployed, triggerOrbit (sobrevoo lento)
t=8500ms   → stopOrbit, dissolve overlay
```

### 5. Suavizar camera clamp durante flyTo
**Arquivo**: `src/components/editor/SkyCanvas.tsx` (CameraController)

O `clampToWorldBounds` ja tem guard `if (isFlyingTo()) return;` que deve funcionar uma vez que o flyTo esteja ativo. Verificar se o import de `isFlyingTo` esta presente no componente.

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| `src/components/editor/VenueShowOverlay.tsx` | Fix geoAnchor sync + flyTo + orbit cinematico |
| `src/core/geo/GoogleTilesEngine.tsx` | Throttle traverse para ~10fps |
| `src/pages/Index.tsx` | Ajustar timing do fluxo — flyTo antes do overlay |

## Ordem de Execucao

| Passo | Tarefa |
|---|---|
| 1 | Fix VenueShowOverlay — adicionar geoAnchor sync + flyTo + orbit |
| 2 | Otimizar GoogleTilesEngine traverse throttle |
| 3 | Ajustar Index.tsx timing (flyTo antes do overlay) |
| 4 | Build verification |

