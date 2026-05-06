
# SkyCanvas v4 — Module Integration + Glass Aprimorado

Trazer os módulos operacionais e criativos já existentes (`src/components/editor/*`) para a superfície `/skycanvas`, organizados em **floating glass islands** com a nova paleta v3 e integrados à estratégia (Strategic Hub, Phase Gates, Honest Hardware, Simulation Guard). Zero impacto em safety: a superfície permanece **inert** (nunca importa `commandBus`/`fieldBus`/`uiCommandGateway.fire`), apenas observa e edita ShowPlan.

## Princípios não-negociáveis

- **Plano canônico:** ShowPlan (`useProjectStore`) — toda edição via store, render via `SkyCanvas2`/`Show3DEngine`.
- **Sem dispatch real:** mantida guard `skycanvas.safetyImports.guard.spec.ts`. Tudo que for ARM/FIRE/E-STOP redireciona para `/command`.
- **Vantablack + cyan-dessat 190 70% 58%** (paleta canônica). Brief #00FFFF/#FF7700 só fora do chrome operacional.
- **Mobile = bottom-sheet** (já implementado): conteúdo dos novos módulos respeita layout mobile.
- **WCAG AA**: contraste mínimo, foco visível, aria-labels.

## Glassmorphism v2 (aprimorado)

Adicionar a `src/index.css` (aditivo, opt-in via classe):

```css
.glass-pane-v2 {
  background:
    linear-gradient(180deg, hsl(220 50% 8% / 0.82), hsl(220 60% 4% / 0.94)),
    radial-gradient(120% 80% at 50% 0%, hsl(190 70% 30% / 0.10), transparent 60%);
  backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid hsl(190 60% 60% / 0.10);
  box-shadow:
    0 1px 0 0 hsl(190 60% 80% / 0.08) inset,   /* specular top */
    0 24px 48px -16px hsl(220 80% 0% / 0.55),  /* drop */
    0 0 0 1px hsl(220 60% 0% / 0.4);           /* hairline */
  isolation: isolate;
}
.glass-section-divider { background: linear-gradient(90deg, transparent, hsl(190 70% 58% / 0.15), transparent); height:1px; }
.glass-chip { background: hsl(220 40% 12% / 0.6); border: 1px solid hsl(190 60% 60% / 0.14); }
```

Renomear nada: `FloatingPanel` ganha prop opcional `variant="v2"` e usa `.glass-pane-v2` quando presente.

## Arquitetura — TabbedDockPanel

Em vez de inflar 200+ painéis soltos, cada uma das 3 ilhas existentes vira um **TabbedDockPanel** com tabs especializadas. Mobile: tabs viram um bottom-tab compacto dentro da sheet ativa.

```text
┌─────────────────────────────────────────────────────────┐
│  GlassTopbar (Master Menu ⌘K · SIM·ADVISORY · E-STOP→/command)
├──────────────┬──────────────────────┬───────────────────┤
│ LIBRARY      │       VIEWPORT       │  INSPECTOR        │
│ [Effects]    │      (SkyCanvas2)    │  [Cue]            │
│ [Fixtures]   │                      │  [Scene]          │
│ [Templates]  │                      │  [Render]         │
│ [Assets]     │                      │  [Hardware*]      │
│ [Show Tpls]  │                      │  [Strategy]       │
├──────────────┴──────────────────────┴───────────────────┤
│ TIMELINE   [Cues] [Audio] [SMPTE] [Validation]          │
└─────────────────────────────────────────────────────────┘
```

`*` Hardware tab é **read-only** (lista observada via `deviceAggregator.watch`). Sem botões de fire.

### Mapeamento de módulos existentes → tabs

**Library (esquerda)**
- Effects → `EffectLibrarySidebar` (já presente)
- Fixtures → `ShowvenEquipmentPanel` (catálogo, drag-only)
- Templates → `ShowTemplatesPanel`
- Assets → `AssetMarketplaceBrowser` (browse, sem checkout)
- Geo → `GeoSearchPanel` + `VenueQuickSelector` (define localização)

**Inspector (direita)**
- Cue → `PropertiesPanel` (ou wrapper minimal sobre cue selecionado)
- Scene → existente (Exposure/FOV) + `WeatherPanel` (visual only) + `LightProgramPanel`
- Render → existente (renderer/tier/budget) + `GpuRendererDiagnosticsPanel` (collapsed)
- Hardware → novo `HardwareObserverTab.tsx`: lista `useActiveControllers()` em modo passivo, link "Abrir em /command"
- Strategy → novo `StrategyContextTab.tsx`: pega `currentSession` do Strategic Hub (read-only), mostra cliente, claim policy badge, link "Abrir em /strategy"

**Timeline (rodapé)**
- Cues → existente (timeline c/ marcadores + waveform)
- Audio → `AudioSpectrumVisualizer` toggle (overlay no waveform)
- SMPTE → `SMPTEPanel` compacto (timecode + offset)
- Validation → `CueValidationConsole` (advisory, simulation guard)

**Master Menu (⌘K) — novas ações**
- "Importar VDL/CSV" → abre `VDLImportPanel`/`CSVImporter` em sheet modal
- "Exportar Show" → `ExportModal` (já honest, anexa disclaimer)
- "AI Builder" → navega `/ai-builder` (não inline, evita peso)
- "Strategic Hub" → `/strategy`
- "Centro de Comando" → `/command`
- "Diagnóstico Render" → toggle `GpuRendererDiagnosticsPanel`

## Integração com Strategy

Adicionar no topbar **selo de sessão ativa** (se houver):

```
[ SIM·ADVISORY ] [ WEBGL2·ULTRA ] [ ▸ Cliente: Maracanã · pilot ]
```

`useActiveDemoSession()` (novo hook em `src/hooks/`) lê `localStorage.fxk.strategy.activeSessionId` (já populado pelo Strategic Hub). Click → navega `/strategy`. Sem sessão, nada aparece.

`ClaimBadge` reutilizado: validated→ds-status-ok, pilot→warn, marketing_hypothesis→sync.

## Honest Hardware integration

`HardwareObserverTab`:
- `useActiveControllers()` para listar dispositivos online
- Cada linha: nome · transport · health (LinkHealth EMA) · provenance badge (LIVE READ-ONLY / SIMULATED)
- CTA único: "Abrir em /command" (nunca dispatch local)
- Empty state: "Nenhum hardware reconhecido — `/dev/real-discovery`"

## Simulation Guard / WorkMode

Topbar mostra `workMode` atual (chip):
- `design` → cyan calmo
- `simulation` → cyan + pulse sutil
- `real_operation` → chip vermelho desabilitado + "Use /command" (link)

Lê de `workModeStore` direto (read-only). Nunca chama `setWorkMode`.

## Arquivos

### Novos
- `src/components/skycanvas/TabbedDockPanel.tsx` — wrapper com Tabs internos honrando bottom-sheet mobile
- `src/components/skycanvas/tabs/LibraryTabs.tsx`
- `src/components/skycanvas/tabs/InspectorTabs.tsx`
- `src/components/skycanvas/tabs/TimelineTabs.tsx`
- `src/components/skycanvas/tabs/HardwareObserverTab.tsx`
- `src/components/skycanvas/tabs/StrategyContextTab.tsx`
- `src/hooks/useActiveDemoSession.ts`
- `src/__tests__/skycanvas.tabs.guard.spec.ts` — garante que tabs novos não importam `commandBus`/`fieldBus`/`uiCommandGateway` (exceto navigate())

### Editados
- `src/index.css` — adicionar tokens `.glass-pane-v2`, `.glass-section-divider`, `.glass-chip` (aditivo)
- `src/components/skycanvas/FloatingPanel.tsx` — prop `variant?: 'v1'|'v2'` (default v1)
- `src/components/skycanvas/skyActions.ts` — novas ações (Import, Export, AI Builder, Strategic Hub)
- `src/pages/SkyCanvas.tsx` — substituir `Inspector`/`TimelineStrip` inline por `InspectorTabs`/`TimelineTabs`; library passa a usar `LibraryTabs`; topbar ganha session chip + workMode chip
- `src/__tests__/skycanvas.safetyImports.guard.spec.ts` — estender allowlist para `tabs/*` mantendo proibições

### Não tocados
- Módulos originais em `src/components/editor/*` (apenas reexpostos; renderização wrapper-thin)
- Safety/CommandBus/FieldBus, qualquer rota `/command`, `/strategy`

## Ordem de implementação (1 PR enxuto)

1. CSS tokens v2 + `FloatingPanel.variant`
2. `TabbedDockPanel` + 3 arquivos `*Tabs.tsx` (mounting wrappers existentes)
3. `HardwareObserverTab` + `StrategyContextTab` + `useActiveDemoSession`
4. Topbar: session chip + workMode chip
5. Master Menu: novas ações
6. Guard test estendido

## Riscos & mitigação

- **Bundle weight:** wrappers carregam módulos pesados. Mitigação: `lazy()` por tab + `Suspense` skeleton.
- **Mobile crowding:** tabs em sheet. Mitigação: cada sheet abre **só uma tab por vez** (já temos `mobileActive`).
- **Drag conflicts:** módulos com seu próprio drag interno (ex.: `EffectLibrarySidebar`). Já neutralizado por `[data-no-drag]` no header — basta marcar áreas drag-source dos painéis com `data-no-drag` se necessário.

Aguardando aprovação para implementar.
