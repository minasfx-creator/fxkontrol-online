# Refino — Templates de Shows Reais + Joi Design & Entregáveis + Posicionamento Google Tiles

Quatro eixos, todos puramente no plano editor/Joi (zero impacto em safety, command center ou hardware).

---

## 1. Templates de show com referências reais (posicionados em coordenadas reais)

Reescrever `src/lib/showTemplates.ts` para que os BUILTIN_TEMPLATES deixem de ser cascas vazias e virem **packs cinematográficos georreferenciados** baseados em shows reais documentados. Cada template ganha:

- `reference`: `{ event, year, location, scale, source }`.
- `venue`: `{ gps:{lat,lng,altMSL,headingFromAudience}, audienceArea:{lat,lng,radiusM}, launchPoints:[{role,lat,lng,heightHintAGL,calibreMax}], waterFeature?:{kind:'river'|'sea'|'lake'|'bay', polygon:LatLng[]}, noFlyZones?:LatLng[][], landmarks?:[{name,lat,lng}] }`.
- `joiPrompt`: prompt pronto para `create_choreography` + `apply_template` + `place_on_terrain`.
- `narrativeBeats`: `{tStart,tEnd,mood,productMix,density}[]` spine do show.
- `paletteName` + `paletteOverride`, `audioCueHints`.

Packs reais (lat/lng/heading verificados; valores indicativos, refináveis):

| Id | Referência | GPS principal | Heading audiência |
|----|-----------|---------------|---------------------|
| reveillon-copa-12min | Réveillon Copacabana RJ 2024, 11 barcas | -22.9711, -43.1822 | 90° (frente p/ orla) |
| reveillon-paulista-3min | Av. Paulista (MASP) | -23.5613, -46.6565 | 0° |
| maracana-final-90s | Maracanã RJ | -22.9122, -43.2302 | centro do gramado |
| festa-junina-arraial-2min | Praça Campina Grande PB | -7.2197, -35.8810 | 180° |
| casamento-praia-buzios-2min | Praia Ferradura | -22.7647, -41.8814 | 270° (mar p/ praia) |
| corporativo-launch-indoor-90s | Allianz Parque SP indoor-safe | -23.5273, -46.6783 | 0° |
| f1-interlagos-podio-45s | Pódio Interlagos | -23.7036, -46.6997 | 0° |
| olympics-opening-anel-5min | Estádio Tóquio | 35.6779, 139.7148 | centro |
| coldplay-music-spheres-180s | Wembley | 51.5560, -0.2796 | norte (palco→pit) |
| natal-shopping-1min | Praça interna shopping | (parametrizável) | livre |
| 4th-july-macys-style-6min | East River NYC | 40.7411, -73.9712 | barcas alinhadas Manhattan |
| diwali-skyline-4min | Marine Drive Mumbai | 18.9442, 72.8237 | mar→cidade |

Cada template gera positions com `lat/lng` reais (não só local XYZ). Ao aplicar, Joi:
1. Recentra `geoAnchor` no `venue.gps`.
2. Materializa positions em `geoToLocal` (worker, Float64).
3. Snap Y em cada position via raycast contra `GoogleTilesGroup` (`raycastTerrainLocal`).
4. Aplica `headingFromAudience` em todas as positions.
5. Renderiza polígonos de `audienceArea` / `noFlyZones` / `waterFeature` como overlays no canvas.

Files: `src/lib/showTemplates.ts` (tipos `VenueGeo`, `LaunchPointGeo`, `NarrativeBeat`; nova lista); `src/components/editor/ShowTemplatesPanel.tsx` (chip evento/ano/escala; minimapa Google Maps Static do `venue.gps`; botão "Pedir pra Joi montar" injeta `joiPrompt`).

---

## 2. Joi — técnicas de design e criação

### 2.1 Choreography helpers (`src/utils/joiChoreographyHelpers.ts`)

- Presets novos: `heart`, `star5`, `fan_array`, `double_arc`, `crescent`, `cross`, `crown`.
- Paletas reais: `reveillon_copa`, `rubro_negro`, `tricolor`, `flamengo`, `palmeiras`, `vasco`, `f1_podio`, `coldplay_spheres`, `oscar`, `diwali`, `chinese_newyear`, `independencia_br`.
- `planNarrativeArc(beats, audioMarkers)` — converte `narrativeBeats[]` + downbeats em janelas de cue com EMA build curve.
- `quantizeToBeatGrid(time, bpm, subdivision, swing?)`.
- `windAwareSpacing(positions, windVec, caliberMm)` — leeward shift conforme NFPA 1123 + cone balístico.
- `palettePhaseRotation(palette, phase)` — luminância crescente intro→climax.

### 2.2 Helpers geo novos (`src/utils/joiGeoHelpers.ts`)

- `materializeGeoLayout(launchPoints, preset, opts)` — usa lat/lng reais ao invés de XZ sintético.
- `orientToAudience(positions, audienceCenter)` — calcula heading por position (azimute geo → local Y rotation, respeitando north-up Three.js).
- `clampToWaterFeature(positions, polygon)` — força barcas dentro do polígono d'água.
- `enforceNoFlyZones(positions, polygons)` — flag/remove positions dentro de exclusões.
- `suggestLaunchGrid(audienceCenter, audienceRadiusM, calibreMm, count)` — distribui posições respeitando raio NFPA por calibre.

### 2.3 Comandos Joi (`src/utils/joiCommandExecutor.ts`)

Novos actions (todos design-only, executam no `useProjectStore` + `useSceneStore.geoAnchor`):

- `set_venue` `{ lat, lng, altMSL?, headingFromAudience?, name? }` — recentra anchor, salva audience heading.
- `apply_template` `{ templateId }` — materializa template + venue + positions geo-snapped.
- `expand_template_to_full_show` `{ templateId, duration }`.
- `place_position_geo` `{ positionId|new, lat, lng, snapToTerrain:true, heading? }` — converte lat/lng→local, raycast Y, aplica.
- `place_positions_along_polygon` `{ polygon:LatLng[], count, role }` — distribui N positions equidistantes ao longo de polígono/linha (ex.: alinhar barcas na orla).
- `snap_all_to_terrain` `{}` — força raycast Y em todas as positions atuais.
- `orient_all_to_audience` `{ audienceLat, audienceLng }`.
- `apply_audio_sync` `{ audioUrl|trackId, snap:"1/16", swing?:0 }`.
- `apply_palette_phase` `{ paletteName }`.
- `mirror_around` `{ axis, anchor }`, `fan_out` `{ angleDeg, count, anchorId }`.
- `query_terrain_height_geo` `{ lat, lng }` → retorna altura local + altMSL (somente leitura, ajuda Joi a raciocinar).
- `query_landmarks_near` `{ radiusM }` — usa Google Places (gateway) para sugerir audiência, palco, exclusões.

### 2.4 Modos & presets (`src/core/joi/joiModes.ts`)

Refinar prompts do modo `show` com `set_venue` + `apply_template` + `snap_all_to_terrain` + `orient_all_to_audience` encadeados em um único turno. Acrescentar presets: SAMBÓDROMO, GRAND PRIX, BROADWAY, FESTIVAL EDM, CASTELO HISTÓRICO.

### 2.5 Style-aware generator (`src/core/joi/JOIStyleAwareGenerator.ts` + `ShowStyleManager.ts`)

- `learnStyleFromTemplate(template)`.
- `crossPollinate(styleA, styleB, ratio)`.

---

## 3. Posicionamento e precisão sobre Google 3D Tiles

### 3.1 Anchor management (`src/store/useSceneStore.ts`)

- Nova action `setVenueAnchor({lat,lng,altMSL,headingFromAudience})` que:
  1. Atualiza `geoAnchorLat/Lon/Alt`.
  2. Chama `useGeo().recenter()` (worker) e aguarda ack.
  3. Re-materializa todas as `positions` (`x,z` recalculados a partir de `position.lat/lng` se existirem).
  4. Dispara `snapAllToTerrain()` após 1 frame (tiles carregados).
- Persistir `headingFromAudience` em `settings`.

### 3.2 Position schema extension (`src/types/projectTypes.ts`)

Adicionar campos opcionais retro-compatíveis em `Position`:
- `geo?: { lat:number, lng:number, altAGL?:number }` — autoridade quando presente.
- `audienceFacing?: boolean` — heading deriva de `audienceCenter`.
- `snappedToTerrain?: boolean` — Y veio de raycast, não input manual.

Quando `geo` presente, o `useProjectStore` recomputa `x,y,z` a cada mudança de anchor (selector memoizado).

### 3.3 Terrain snap robusto (`src/core/geo/terrainQuery.ts` + `useTerrainHeightCache.ts`)

- `raycastTerrainGeo(lat, lng, scene, anchor) → {y, hit, msl}` — converte via worker e cai em `getTerrainHeight` quando tile pronto.
- Polling com retry exponencial até 5 s (tiles carregam progressivamente).
- `useTerrainHeightCache` ganha listener de `tilesLoaded` (event do `GoogleTilesEngine`) para invalidar e re-snap as positions afetadas.
- Cache key passa a usar `(round(x*10), round(z*10), anchorHash)` para invalidar em recenter.

### 3.4 Audience-aware heading (`src/core/geo/audienceAzimuth.ts` novo)

- `azimuthDeg(fromLat, fromLng, toLat, toLng)` — Haversine bearing.
- `audienceHeadingFor(pos, audienceCenter)` → 0..360 ENU; converter para Three.js Y rotation (`-azimuth + 90°` mantém north-up).
- Integração: `orient_all_to_audience` percorre positions e seta `heading`.

### 3.5 Overlay de venue no SkyCanvas (`src/components/editor/VenueShowOverlay.tsx`)

Render passivo (decorativo) quando template ativo:
- Polígono `audienceArea` (cyan fill α=0.08, stroke α=0.4).
- Polígonos `noFlyZones` (amber dashed).
- Polígono `waterFeature` (azul-petróleo, opcional).
- Pins de `landmarks` com label (Text sprite).
- Ring NFPA por calibre em cada launch point (raycast Y; cor por calibre).
- Toggle em `ShowSettingsPanel` (`showVenueOverlays:boolean`).

### 3.6 Precision UX (PositionPins)

Em `src/components/editor/PositionPins.tsx`:
- Tooltip ao hover mostra `lat, lng, altMSL, altAGL, distância à audiência`.
- Drag em XZ recomputa `geo.lat/lng` (inversão `localToGeo`) e dispara re-snap Y.
- Indicator visual quando `snappedToTerrain=false` (warning chip "manual height").

### 3.7 Integração Google Maps Platform

Para `query_landmarks_near` e `place_positions_along_polygon`, usar o connector Google Maps via gateway (`places/v1/places:searchNearby` + `places:searchText`). Já está conectado ao projeto (`GoogleTilesEngine` consome a browser key) — só falta uma edge function fina `joi-places-search` server-side que Joi chama, retornando lat/lng/nome/tipo para overlay. Out-of-scope criar nova conexão se já houver; reaproveitar a managed.

---

## 4. Joi — documentação e entregáveis

### 4.1 PDF (`src/utils/joiPdfExport.ts`)
- Capa premium (nome, evento, data, cliente, escala, QR).
- Sumário executivo (paleta, arco dramático, peças-chave).
- **Planta georreferenciada**: print do canvas Google Tiles com overlays venue (audiência, exclusões, NFPA rings), legenda, escala m/ft, norte.
- Tabela NFPA 1123 `Caliber × Distância × Raio audiência`.
- BoM agrupado por fornecedor (Showven/Lidu/Magic/Winda/Amazon/FireOne) com subtotais.
- Timeline operacional (Gantt simples).
- Matriz de cues (cue#, t, posição com lat/lng, produto, canal, calibre, cor).
- Anexos: contingências, primeiros socorros, contatos.

### 4.2 DOCX (`src/utils/joiDocxExport.ts`)
Templates: Proposta Comercial, Contrato de Espetáculo, Ofício DECEA, Declaração de Segurança, Acreditação Bombeiros — preenchidos automaticamente a partir do show ativo + `venue.gps`.

### 4.3 KMZ aéreo (`src/utils/joiAeroKmzExport.ts`)
- Polígono de exclusão (raio máx calibre + buffer) em torno do `venue.gps`.
- Anéis concêntricos por altitude (200/400/600/1000 ft).
- Waypoints com hover (posição/calibre/horário).
- Estilo NOTAM-friendly + DECEA AISWEB.
- Exports: `.kmz` + `.kml` + `.csv` WGS84.

### 4.4 Checklist regulatório (`src/utils/regulatoryChecklist.ts`)
Cobertura BR completa: Exército (R-105, PIE), PolCivil, Bombeiros (AVCB/CLCB), Anvisa (cold sparks indoor), Prefeitura, DECEA (NOTAM), ANAC (drone), seguro RC, ART, prazos típicos, link de origem.

### 4.5 Dossiê do Show (novo)
`src/utils/joiDossierExport.ts` empacota PDF técnico + DOCX (proposta+contrato+ofícios) + KMZ + CSV BoM + checklist regulatório em `.zip` versionado (`show-<slug>-v<n>.zip`). Action Joi: `export_dossier`. Preset DOCS "DOSSIÊ COMPLETO".

---

## Fora de escopo

Safety state machine, uiCommandGateway, CommandBus/FieldBus, `/command`, pairing, workMode API, aiGuardrail físico, autenticação, edge functions de hardware. Tudo intocado.

## Verificação

- `bunx vitest run` cobrindo:
  - `joiChoreographyHelpers` + `joiGeoHelpers` (`audienceAzimuth`, `clampToWaterFeature`, `enforceNoFlyZones`, `suggestLaunchGrid`).
  - `terrainQuery.raycastTerrainGeo` com mock de scene/tiles.
  - `useSceneStore.setVenueAnchor` re-materializa positions com `geo`.
- Smoke visual no `/editor`:
  - Aplicar Reveillon Copa → câmera vai p/ Copacabana, 11 barcas snapadas no mar.
  - Aplicar Maracanã Final → câmera no estádio, ring NFPA visível.
  - Aplicar Coldplay Wembley → palco e pit destacados, beam de audiência.
- Render 1 PDF + 1 KMZ + 1 dossiê do show "Reveillon Copa" e abrir para inspeção.
