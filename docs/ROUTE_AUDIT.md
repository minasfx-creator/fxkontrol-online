# Auditoria de Rotas e Páginas — Rodada 2 (executada)

Base pós-execução. Conclusões iniciais da Rodada 1 foram **revisadas** após auditoria precisa de uso real.

---

## Páginas DELETADAS na Rodada 2 (5)

| Arquivo | Justificativa |
|---|---|
| `pages/AIChoreography.tsx` | Rota → `Navigate /ai-builder`; zero refs externas |
| `pages/SwarmGPT.tsx` | Rota → `Navigate /ai-builder`; zero refs externas |
| `pages/Admin.tsx` | Rota → `Navigate /office?tab=compliance`; substituída por placeholder em `Office` |
| `pages/Agenda.tsx` | Rota → `Navigate /office?tab=agenda`; substituída por placeholder em `Office` |
| `pages/Training.tsx` | Substituída por `TrainingCenter`; placeholder em `Office?tab=training` |

**Ajustes:** `src/lib/prefetchRoutes.ts` reescrito (rotas de páginas deletadas removidas; adicionadas `/office`, `/training/center`); `src/pages/Office.tsx` agora usa placeholders apontando pras rotas canônicas.

---

## Páginas RECLASSIFICADAS como KEEP (auditoria revisada)

A Rodada 1 marcou estas pra deleção, mas auditoria precisa mostrou uso ativo:

| Arquivo | Uso real descoberto |
|---|---|
| `pages/Dashboard.tsx` | Importada por `Office.tsx` como tab `overview` (default) |
| `pages/AccreditationDashboard.tsx` | Importada por `Office.tsx` como tab `documents` |
| `pages/FieldTest.tsx` | Importada por `CommandCenter.tsx` como tab `field_test` |
| `pages/FXK16ValidatePage.tsx` | Importada por `dev/FXK16Hub.tsx` como tab `validate` |
| `pages/FXK16CalibrationPage.tsx` | Importada por `dev/FXK16Hub.tsx` como tab `calibrate` |
| `pages/DevicePairing.tsx` | Importada por `FieldOps.tsx` e `FXKNetPanel.tsx` como sub-view |

Conclusão: 6 páginas erroneamente marcadas DELETE na Rodada 1 — agora reclassificadas como **KEEP** (são componentes-de-tab embora vivam em `pages/`).

---

## Métricas finais

- Páginas pré-rodada: **43**
- Deletadas: **5**
- Páginas pós-rodada: **38** (-12%)
- Rotas: **49** (mantidas; só removidos imports lazy de páginas inexistentes — App.tsx já não as importava)
- Refs órfãs corrigidas: 8 (`prefetchRoutes.ts`, `Office.tsx`)

---

## Pendência sugerida pra Rodada 3 (reorganização física)

As 6 páginas reclassificadas como "tab-de-outra-página" deveriam ser movidas pra `src/components/office/`, `src/components/command/`, `src/components/dev/fxk16/` etc. e deixar `src/pages/` só com **rotas reais**. Fica pra Rodada 3.

---

## Rodada 3 — Reorganização física (executada)

As 6 páginas-de-tab foram movidas pra suas pastas de domínio. `src/pages/` agora contém só rotas reais.

| Origem | Destino |
|---|---|
| `src/pages/Dashboard.tsx` | `src/components/office/DashboardPanel.tsx` |
| `src/pages/AccreditationDashboard.tsx` | `src/components/office/AccreditationPanel.tsx` |
| `src/pages/FieldTest.tsx` | `src/components/command/FieldTestPanel.tsx` |
| `src/pages/FXK16ValidatePage.tsx` | `src/components/dev/fxk16/ValidatePanel.tsx` |
| `src/pages/FXK16CalibrationPage.tsx` | `src/components/dev/fxk16/CalibrationPanel.tsx` |
| `src/pages/DevicePairing.tsx` | `src/components/field/DevicePairingPanel.tsx` |

**Imports atualizados:** `src/App.tsx` (lazy imports mortos removidos), `src/pages/Office.tsx`, `src/pages/CommandCenter.tsx`, `src/pages/FieldOps.tsx`, `src/pages/dev/FXK16Hub.tsx`, `src/components/editor/live-firing/FXKNetPanel.tsx`, `src/pages/__tests__/FieldTest.shell.test.tsx`.

### Métricas finais (pós-Rodada 3)
- `src/pages/` (root): **32 arquivos** (era 38) — só rotas reais + subpastas `create/`, `dev/`, `legal/`, `videoEditor/`, `__tests__/`
- Componentes-de-tab agora vivem em `src/components/{office,command,field,dev/fxk16}/`
- Build TS: ✅ sem erros

---

## Rodada 4 — Aposentadoria do Index.tsx legado (executada)

`src/pages/Index.tsx` (861 linhas, ~80 painéis lazy) foi **deletado**. Toda a funcionalidade de criação/edição/simulação foi migrada para `SkyCanvas` (DS v1 EditorShell) nos Rounds 1-3, com 23 wrappers de aba e 4 viewport overlays.

### Mudanças

| Antes | Depois |
|---|---|
| `/studio` → `<Index />` | `<Navigate to="/skycanvas" replace />` |
| `/editor` → `<Index />` | `<Navigate to="/skycanvas" replace />` |
| `/editor/:showId` → `<Index />` | `<Navigate to="/skycanvas" replace />` |

**Arquivos editados:** `src/App.tsx`, `src/lib/prefetchRoutes.ts` (`/`, `/editor`, `/studio` apontam pra `Auth`/`SkyCanvas`).

### Métricas finais

- `src/pages/` (root): **31 arquivos** (era 32)
- LOC removidos: **−861** (Index.tsx)
- Testes: **57/57 verde** (`skycanvas.safetyImports.guard` + `skycanvas.editorShell.smoke` + `skyCanvas3d.smoke`)
- Surface canônica de criação 3D: `/skycanvas` (única)

---

## Rodada 5 — Limpeza de órfãos pós-Index.tsx (executada)

Auditoria de imports em `src/components/editor/*.tsx` (239 arquivos) detectou **11 candidatos a órfão**, dos quais **5 confirmados sem nenhuma referência viva** (eram importados apenas pelo extinto `pages/Index.tsx`):

| Componente | LOC aprox. | Substituto canônico |
|---|---|---|
| `DiagnosticPanel.tsx` | ~ | `SkyCanvasDiagnosticsPanel` (in-viewport) |
| `FlightLogPanel.tsx` | ~ | `/field` telemetry surface |
| `LogisticsPanel.tsx` | ~ | `/office?tab=logistics` (a integrar) |
| `ReportsPanel.tsx` | ~ | `/strategy` reports + PDF gen |
| `TelemetryDashboard.tsx` | ~ | `TelemetryBar` + `/field` |

Os outros 6 (PerformanceHUD, RenderDebugOverlay, SkyCanvasDiagnosticsPanel, TelemetryBar, TerrainCacheMetricsPanel, TerrainDebugOverlay) **foram preservados** — ainda são consumidos pelo `components/editor/SkyCanvas.tsx` (motor 3D legado, separado do `pages/SkyCanvas.tsx` DS v1).

### Métricas

- `src/components/editor/`: **239 → 234** arquivos (−2.1%)
- Testes: **63/63 verde** (skycanvas guards + smoke + commercial theme + typography DS)

### Pendência Rodada 6 (sugerida)

Consolidar mounts duplicados de `SkyCanvas2`/`SkyCanvas3D` em `/dev/skycanvas-{smoke,3d,2}` — hoje há 3 demos isoladas + 2 importações em produção (`SkyCanvasMount.tsx` + `pages/SkyCanvas.tsx`). Avaliar se as 3 rotas dev podem virar um único `/dev/skycanvas-lab` com toggle.

---

## Rodada 6 — Consolidação SkyCanvas dev lab (executada)

3 rotas dev distintas (`/dev/skycanvas-{smoke,3d,2}`) consolidadas em um único harness `/dev/skycanvas-lab` com toggle de variante (smoke/r3f/v2). Reduz 3 chunks lazy → 1 e simplifica QA.

### Mudanças

| Antes | Depois |
|---|---|
| `pages/dev/SkyCanvasSmoke.tsx` | DELETADO |
| `pages/dev/SkyCanvas3DDemo.tsx` | DELETADO |
| `pages/dev/SkyCanvas2Demo.tsx` | DELETADO |
| 3 lazy imports + 3 rotas `<Route element=…>` | 1 lazy `SkyCanvasLab` + 3 `<Navigate>` legacy |

`SkyCanvasLab.tsx` mantém todas as features:
- Variant pinned via `?v=smoke|r3f|v2` (URL persistida via `useSearchParams`)
- Smoke usa `SkyCanvasMount` (mesmo de produção)
- R3F seed determinístico (4 positions + 4 cues) preservado
- v2 query flags `?perf ?nostars ?nogrid ?nostage ?stage=minimal` preservadas
- Toggle UI inline (3 chips top-left) com `aria-pressed`

### Métricas

- `src/pages/dev/`: **12 → 10** arquivos
- `src/App.tsx`: −2 lazy roots, +3 redirects
- Testes: **57/57 verde**
