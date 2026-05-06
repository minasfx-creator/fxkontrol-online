# SkyCanvas v3 — Plano revisado (engenharia sênior · WebGL/UX/HW)

## 1. Diagnóstico de causa-raiz (o que realmente quebra)

| # | Sintoma | Causa real | Onde corrigir |
|---|---------|-----------|---------------|
| A | Splash preto com logo laranja não sai | Vários `import()` retornam **502** mid-session (SkyCanvas, Timeline, KeybindingCheatSheet, safetyEngine, NiagaraVFXController, GeoToolsR3F, ViewportRulers, PositionTransformGizmo, ARScanEffect, BoidsVisualizer, activeRendererRegistry…). `lazyRetry` reload-once não recupera todos. React nunca termina de montar → splash do `index.html` permanece. | Boot mínimo + reduzir grafo de imports; `__splashDone` no `useEffect` da página, não no `requestIdleCallback`. |
| B | "Loading is taking longer than expected · Force WebGL2 / Reload Studio" no /office | `CanvasLoaderWithTimeout` está sendo herdado por rotas que não montam canvas. | Loader contextual; só Suspense de canvas usa esse fallback. |
| C | Desktop não carrega | GPU fallback SwiftShader (Chrome avisa: *"Automatic fallback to software WebGL has been deprecated"*) + chunk 502 = double whammy. | Detector de SwiftShader → modo 2D automático; budget DPR=0.75. |
| D | Celular landscape não carrega | `useIsMobile` está correto (h≤500 + coarse), mas o branch mobile do `Index.tsx` ainda lazy-carrega EngineProvider, AutoControllerLauncher, FXKAssistant, useHardwareSyncLoop(44). | Página nova não importa nada disso. |
| E | Sandbox preview não tem `navigator.gpu` | WebGPU indisponível em sandboxes/headless. | Capability matrix antes de escolher renderer. |
| F | Splash dismiss frágil | `requestIdleCallback` nunca dispara sob R3F load. | Triple fallback já existe, mas a rota nova vai dispatcher manual no primeiro `useEffect`. |

## 2. Arquitetura SkyCanvas v3

Surface enxuta, isolada do `Index.tsx`. Reusa o que já é estável.

```text
┌──── Topbar 56 (logo · transport · status · clock · E-STOP) ──────┐
│ Library 280 │   Viewport (SkyCanvas2 ou SkyFallback2D)   │ Insp 320│
│  effects    │                                            │ cue     │
│  positions  │                                            │ scene   │
│  strategy   │                                            │ render  │
├─────────────┴─── Timeline 180 (waveform + playhead) ───────────────┤
└────────────────────────────────────────────────────────────────────┘
```

Princípios:
- **Show/Experience plane only**. Zero CommandBus / FieldBus / SafetyStateMachine / workMode.
- `EditorShell` (constraints, não auto-layout) já provado em `/dev/editor-shell`.
- Engine: **SkyCanvas2** (modular, instanced, com `WebGLContextRecovery` + `AdaptiveDPRController` + `SkyCanvas2ErrorBoundary` próprio).
- Estado: `useProjectStore` + `usePersistedProject`. Sem `EngineProvider` nesta rota.
- Safety: `GlobalEStopButton` continua via `MainLayout`.

## 3. Capability matrix · escolha de renderer (gap crítico)

```text
                 WebGPU?  WebGL2?  SwiftShader?  →  Renderer escolhido
desktop hi-end    sim      sim       não          →  SkyCanvas2 (DPR 1–1.75)
desktop low/iGPU  não      sim       não          →  SkyCanvas2 (DPR 1–1.25)
sandbox/preview   não      sim       sim          →  SkyFallback2D
iOS Safari        não      sim*      não          →  SkyCanvas2 (DPR 1, no MSAA)
landscape phone   não      sim       não          →  SkyCanvas2 leve (no fixtures, no stage extras)
no WebGL          não      não       —            →  SkyFallback2D
```

Detecções:
- `navigator.gpu` (WebGPU)
- `canvas.getContext('webgl2')` (real ctx, não só feature)
- WEBGL_debug_renderer_info → string contém `SwiftShader|llvmpipe|Software`
- `pointer: coarse` + `max-height: 500px` (mobile landscape)
- `prefers-reduced-motion` (corta partículas/bloom)
- Battery API + Network Information API (modo econômico)

Resultado vai pra um `RenderProfile` (low/mid/high) que controla:
- DPR clamp
- AA on/off
- Stage layer on/off
- Fixtures layer on/off
- Particle cap
- Shadow off (já é off no v2)

## 4. Boot sequence (rota `/skycanvas`)

1. **HTML splash** (já existe).
2. Página monta → `useEffect` chama `__splashDone()` na hora.
3. `EditorShell` desenha topbar + sidebars com placeholders (skeletons DS).
4. Capability detect (síncrono, <5ms).
5. Decide renderer.
6. Suspense do viewport carrega `SkyCanvas2` OU `SkyFallback2D`.
7. Sidebars hidratam dados em paralelo (não bloqueiam viewport).
8. Timeline conecta `useAudioMasterClock` só após primeiro paint.

**Telemetria de boot**: marca `skycanvas:boot:start`, `skycanvas:viewport:ready`, `skycanvas:interactive`. Vai pra `runtimeMonitor` (já existe).

## 5. Performance budgets (engenharia, não wishful thinking)

| Métrica | Desktop | Mobile landscape | Sandbox |
|---|---|---|---|
| TTI da rota | <2.5s | <3.5s | <4s |
| FPS viewport | 60 | 30 | 30 (2D) |
| DPR | 1.0–1.75 | 1.0–1.25 | 0.75 |
| Draw calls | <12 | <8 | n/a |
| JS heap | <120MB | <80MB | <60MB |
| Bundle inicial da rota | <180KB gzip | mesmo | mesmo |

Defesas:
- `Page Visibility API` → `frameloop='never'` quando aba escondida.
- `IntersectionObserver` no canvas → pausa quando fora de viewport.
- `requestIdleCallback` para waveform decode.
- Web Worker para waveform PCM (não bloqueia main).
- `dispose()` rigoroso de geometry/material/texture no unmount.

## 6. Resiliência (cobre as 502 reais)

- **Imports paralelos pré-warmados** dos módulos críticos via `<link rel="modulepreload">` injetado dinamicamente.
- **Fallback duplo por chunk**: `lazyRetry` (existe) + componente `<ChunkBoundary>` que mostra "recarregando módulo X · botão retry".
- **Service worker desligado em preview** (já está).
- **Error boundary por zona** (topbar, library, viewport, inspector, timeline) — uma zona quebrada não derruba a página.
- **WebGL context-loss** → `SkyCanvas2` já recupera; no v3, ao 3º loss em 30s, degrada para 2D.
- **Splash safety net extra**: se React monta mas error-boundary trip antes do canvas, splash sai mesmo assim.

## 7. UX/UI (premium, real)

- **Tema**: Vantablack `#050810` + cyan-dessat 190/70/58 (canônico). Sem `--primary` laranja no chrome.
- **Tipografia**: escala DS (`text-ds-h1..caption`, `.ds-mono`).
- **Hierarquia**: status > conteúdo > decoração. WCAG AA em todos os pares.
- **Estados**: skeleton (DS) → fade-in 200ms → conteúdo. Sem CLS.
- **Microinterações**: hover 120ms, click 80ms, snap timeline 4px dead-zone.
- **Transport**: spacebar play/pause, J/K/L (RV cinema), Home/End, ←/→ ±1 frame, Shift+←/→ ±10.
- **Drag&drop**: `application/x-fxk-effect` (canônico) da library pra timeline e pra viewport.
- **Inspector colapsável** (drawer em landscape mobile).
- **Reduced motion**: corta partículas, mantém transport.
- **Color-blind safe**: status sempre tem ícone + cor, nunca só cor.
- **Foco visível**: ring DS em todo elemento interativo.
- **Empty state**: "Arraste um efeito ou peça pra IA gerar uma sequência" — sem ficar branco.

## 8. Acessibilidade

- Canvas com `role="img"` + `aria-label` dinâmico.
- Atalhos com `aria-keyshortcuts`.
- Foco trap em modais, não no canvas.
- `prefers-reduced-motion` respeitado.
- Touch targets ≥44px (iOS HIG).
- `min-h-dvh` + `env(safe-area-inset-*)` em todo container raiz.

## 9. Mobile / landscape (resolve o "celular deitado")

Três modos resolvidos por `RenderProfile` + container queries:

- **landscape phone (h≤500 + coarse)**: topbar 44, viewport full, drawers laterais escondidos (toggle), timeline 96 colapsável.
- **portrait phone (<768w)**: viewport + bottom tabbar com Library/Inspector/Timeline.
- **tablet/desktop**: layout completo.

Sem dependência do branch mobile pesado do `Index.tsx`.

## 10. Renderer: hardening WebGL

- `gl: { antialias: profile==='high', alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false, preserveDrawingBuffer: false }`
- Tone mapping ACES (já no v2).
- Color space sRGB out / Linear work.
- Frustum culling agressivo.
- InstancedMesh para pads, Points para drones, pool fixo (256) para bursts. (já no v2)
- `THREE.Cache.enabled = true`.
- Texture max 1024px no perfil low.
- Stage e Fixtures atrás de flag por perfil.

## 11. Hardware (engineer hat)

Esta página **não toca em hardware real**. Mas:
- Não bloqueia E-STOP global.
- Não importa transports (`pyroUsb`, `artnet`, `ltc`).
- Quando o usuário quiser executar de verdade, ele vai pro `/command` (caminho canônico via `uiCommandGateway`).
- Garante que o `runtimeMonitor` registra qualquer crash pra correlação com o Black Box.

## 12. Limpeza arquitetural (cumpre o pedido de organizar)

Aplicado em paralelo, commits separados:
- Aplicar `docs/ROUTE_AUDIT.md` — remover 10 rotas órfãs (AIChoreography, Accreditation, SwarmGPT, Admin, Agenda, Training duplicado, Dashboard, DevicePairing, FieldTest duplicado, FXK16Validate/Calibrate).
- Consolidar `EffectLibrary` + `EffectLibrarySidebar` → 1 componente.
- Consolidar `/dev/skycanvas-3d`, `/dev/skycanvas-2`, `/dev/skycanvas-smoke`, `/dev/video-editor` → manter só `/dev/skycanvas-smoke` (QA isolado) e `/skycanvas` (canônico).
- `AppSidebar`: item "SkyCanvas" aponta `/skycanvas` (Studio fica como rota legacy interna).
- Remover imports órfãos detectados na análise.
- ESLint: regra para proibir import de `Index.tsx` fora de `/studio`.

## 13. Testes

- **Smoke**: rota monta sem erro em viewport 1366×768, 1024×768, 834×1194, 414×896, 360×800.
- **Capability**: simula `navigator.gpu` undef, SwiftShader, no-WebGL → cada um cai no path certo.
- **Boot timing**: TTI <2.5s desktop em CI.
- **Memory**: heap snapshot antes/depois de mount/unmount (delta <5MB).
- **Visual regression**: Playwright screenshot dos 3 modos.
- **Safety guard**: teste que falha se a rota importar `commandBus`, `fieldBus`, `safetyStateMachine`.
- **A11y**: axe-core sem violações nos chrome elements.

## 14. Documentação

- `docs/architecture/skycanvas-v3.md` — overview, capability matrix, perfis, fluxo de boot.
- Atualizar `docs/architecture/entry-points.md`.
- Atualizar `docs/ROUTE_AUDIT.md` com as remoções aplicadas.
- Memória: criar `mem://funcionalidades/skycanvas-v3` no índice.

## 15. Plano de execução (faseado, entregável por fase)

**Fase 1 — Surface viva (≈1 sessão)**
1. Rota `/skycanvas` + `SkyCanvas.tsx` com `EditorShell`.
2. Capability detect + RenderProfile.
3. SkyCanvas2 mount + SkyFallback2D.
4. `__splashDone` no mount + telemetria boot.

**Fase 2 — Editor real**
5. EffectLibrary (esquerda).
6. Inspector (direita) com 3 abas.
7. Timeline com waveform (Web Worker) + sync `useAudioMasterClock`.
8. Drag&drop library → timeline → viewport.

**Fase 3 — Resiliência + responsividade**
9. Error boundary por zona + ChunkBoundary visível.
10. Modo landscape/portrait/tablet com container queries.
11. Reduced motion, color-blind, ARIA, atalhos completos.
12. Tests (smoke + capability + a11y + safety guard).

**Fase 4 — Limpeza**
13. Aplicar ROUTE_AUDIT.md.
14. Consolidar EffectLibrary.
15. Apontar AppSidebar pra /skycanvas.
16. Documentar.

## 16. O que NÃO faço (escopo trancado)

- Não toco em safety, command, FieldBus, workMode, CommandBus.
- Não removo `/studio` antigo agora — só desvio o tráfego principal.
- Não promovo essa surface pra `real_operation`.
- Não troco palette canônica (Vantablack/cyan-dessat).
- Não introduzo dependências novas (sem react-three/postprocessing extra, sem styled-components, sem framer-motion novo).

## 17. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| 502 voltam em chunks novos | Lazy boundaries por zona + retry visível + boot mínimo |
| GPU sandbox SwiftShader | Detector + 2D fallback automático |
| iOS Safari WebGL2 quirks | Profile iOS específico (DPR 1, no MSAA, no fixtures) |
| Audio gesture requirement | Transport pede 1 click do usuário antes de tocar |
| Splash não sai se boundary trip | Dismiss no `<App>`, não na página |
| Memory leak no canvas | Disposal canônico no unmount + Page Visibility pause |
| Container queries em browsers antigos | Fallback `useIsMobile` (já existe) |

---

Aprovando, começo pela **Fase 1** (rota viva + capability detect + viewport com fallback) e te entrego funcionando antes de seguir para editor real, resiliência e limpeza.