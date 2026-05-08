
# Plano — Layout Definitivo do Editor SkyCanvas

Você confirmou: o layout que aparece em **/dev/skycanvas-lab** (variante `smoke` = `SkyCanvasMount` puro, fullscreen, sem chrome pesado) é o layout definitivo do viewport. Vamos promovê-lo para a rota de produção (`/skycanvas` e VideoEditor) com refinamentos cirúrgicos e uma **timeline glassmorphism** unificando tudo que já temos (waveform, cues, lanes pyro/sfx/drone/light/dmx, transport, drag-drop de efeitos).

Plano: **Show / Experience**. Zero CommandBus / FieldBus / SafetyStateMachine. Real operation continua em `/command`.

## 1. Novo componente canônico — `SkyCanvasViewportShell`

Arquivo novo: `src/components/skycanvas/SkyCanvasViewportShell.tsx`.

Estrutura (tela cheia, fundo Vantablack `#050810`):

```text
┌──────────────────────────────────────────────────────────────┐
│  [Glass Topbar pill]  centrado · variante minimal do atual   │  ← 56px, flutuante
│                                                              │
│                                                              │
│              SkyCanvasMount (engine='auto')                  │  ← fill 100%
│              (mesmo do /dev/skycanvas-lab smoke)             │
│                                                              │
│                                                              │
│  [ViewportBar flutuante topo-centro]                         │  ← já existe
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [Glass Timeline Dock — 200px, glassmorphism forte]          │  ← novo, colapsável
│   Transport · Timecode · Waveform · Cue lanes · Drop zone    │
└──────────────────────────────────────────────────────────────┘
```

Princípios:
- **Sem grid rígido `EditorShell`** no modo lab-like. Painéis Library/Inspector viram **dock flutuante glass colapsado por default** (acessível por tecla ou ícone), liberando o viewport.
- Topbar fica como **pill flutuante** glass (não barra full-width). Reaproveita `GlassTopbar` de `pages/SkyCanvas.tsx` em variante `compact`.
- Timeline na base é **glass-pane forte** (não quadrado opaco), bordas arredondadas, recolhível com `⌘3`.

## 2. Timeline Glassmorphism — `GlassTimelineDock`

Arquivo novo: `src/components/skycanvas/GlassTimelineDock.tsx`.

Reutiliza 100% de tecnologia existente — zero engine novo:

| Camada | Origem | Função |
|---|---|---|
| Background glass | `glass-pane glass-pane-strong` (token DS) | blur + Vantablack 60% |
| Transport | `TransportBarLegacy` (legacy-2604) | Play/Pause/Stop/seek/timecode |
| Waveform | `WaveformLayer` + `decodeAudioPeaks` (lib/skycanvasAudioPeaks) | onda audio decodificada |
| Cue ruler | `TimelineStripView` (já modular) | régua + cue markers + drop `FXK_EFFECT_DRAG_TYPE` |
| Lanes Pyro/SFX/Drone/Light/DMX | `FiringLanesTimelineLegacy` | 5 lanes coloridas |
| Sync | `useShow3DEngineSync` + `useProjectStore.currentTime` | clock master = audio (memória `show3d-timeline-audio-sync`) |
| Selo | DS chip "SIM · ADVISORY" + claim badge | reaproveita `Badge` |

Layout interno (200px alt total):
- Topo 32px: transport pill + timecode SMPTE 29.97 + speed selector
- Meio 80px: waveform + cue markers (TimelineStripView mode='ruler')
- Base 88px: 5 lanes empilhadas (FiringLanesTimelineLegacy compact)

Glass tokens: `bg-[#050810]/55 backdrop-blur-2xl border-t border-cyan-500/10 shadow-[0_-8px_32px_rgba(0,0,0,0.6)]`. Cores cyan-dessat 190° (canônico).

Drop zones: arrastar de `EffectLibrarySidebar` para qualquer lane cria cue na lane correta (já implementado em `TimelineStripView.onDrop`).

## 3. Refinamentos pedidos (sobre o lab atual)

1. **Removidos**: barra de toggle `SMOKE/R3F/V2` no topo-esquerda (era dev-only). Em produção fica só o glass topbar.
2. **Adicionado**: `SkyCanvasDiagnosticsPanel` como overlay opcional (toggle por `?diag=1` ou tecla `Ctrl+Shift+D`).
3. **Adicionado**: `ViewportBar` (preset cam/grid/axes/ground) no topo-centro (já existe, só montar).
4. **Adicionado**: `JoiAvatarFab` no canto inferior-direito (já existe em legacy-2604).
5. **Mantido**: `AutoControllerLauncher` global (vem do `MainLayout`).
6. **Layout responsivo**: <md, timeline vira sheet bottom (`MobilePanelSwitcher` já cobre o resto).

## 4. Adoção nas rotas

Editar:
- `src/pages/SkyCanvas.tsx` — substituir o `EditorShell` por `<SkyCanvasViewportShell>`. Master Menu (⌘K) preservado. Persistência de layout (`useEditorLayout`) reduzida a: `timelineCollapsed`, `diagOpen`, `libraryDrawerOpen`, `inspectorDrawerOpen`. Painéis Library/Inspector continuam acessíveis via drawer glass (ícone lateral) — não somem, só não ocupam grid fixo.
- `src/pages/dev/SkyCanvasLab.tsx` — variante `smoke` agora monta `<SkyCanvasViewportShell variant="dev">` para WYSIWYG entre dev e prod. Variantes `r3f` e `v2` preservadas.
- `src/pages/VideoEditor.tsx` — opt-in via flag `editor_shell_v2_lab` (default OFF nesta primeira rodada para evitar regressão).

## 5. Safety / Memory / Tests

- Guard test novo: `src/__tests__/skycanvasViewportShell.guard.spec.ts` — proíbe imports de `@/core/safety/safetyStateMachine`, `@/core/hardware/fieldBus`, `@/core/command/commandBus` dentro de `SkyCanvasViewportShell` e `GlassTimelineDock`.
- Smoke test: `src/__tests__/glassTimelineDock.smoke.test.tsx` — render com `peaks=null`, com peaks decoded mock, drop de effectId cria cue, click seek atualiza store.
- Memória nova: `mem://funcionalidades/skycanvas-viewport-shell-canonical` — registra que `SkyCanvasViewportShell + GlassTimelineDock` é o layout canônico do editor (Show plane), reutilização das peças legacy-2604 + TimelineStripView + WaveformLayer + skycanvasAudioPeaks, e que dev/lab e prod são WYSIWYG.
- Atualiza `mem://funcionalidades/skycanvas-mount-canonical` mencionando o shell wrapper.
- Vantablack `#050810` + cyan-dessat 190 70% 58% preservados (canônicos).

## 6. Arquivos

**Novos**
- `src/components/skycanvas/SkyCanvasViewportShell.tsx`
- `src/components/skycanvas/GlassTimelineDock.tsx`
- `src/components/skycanvas/timeline/GlassTimelineLanes.tsx` (wrapper compact de `FiringLanesTimelineLegacy`)
- `src/__tests__/skycanvasViewportShell.guard.spec.ts`
- `src/__tests__/glassTimelineDock.smoke.test.tsx`
- `.lovable/memory/funcionalidades/skycanvas-viewport-shell-canonical.md`

**Editados**
- `src/pages/SkyCanvas.tsx` (troca EditorShell → SkyCanvasViewportShell, mantém Master Menu, atalhos, persistência reduzida)
- `src/pages/dev/SkyCanvasLab.tsx` (variant smoke usa o shell)
- `.lovable/memory/funcionalidades/skycanvas-mount-canonical.md` (nota cruzada)

**Não tocados** (regressão garantida)
- `SkyCanvasMount.tsx`, `SkyCanvas2.tsx`, `SkyCanvas3D.tsx`, `EditorShell.tsx`, qualquer arquivo em `core/safety|hardware|command`, `MainLayout.tsx`, `GlobalEStopButton`.

## 7. Confirma?
Aprovando, eu implemento na próxima rodada (criação dos 6 arquivos + edição cirúrgica de `pages/SkyCanvas.tsx` e `SkyCanvasLab.tsx`). O viewport `/skycanvas` passa a ter exatamente a sensação fullscreen do `/dev/skycanvas-lab` + a timeline glassmorphism unificada.
