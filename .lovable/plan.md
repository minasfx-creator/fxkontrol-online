# Próximo incremento — SkyCanvas v3 + plataforma refatorada

A entrega anterior cobriu TabbedDockPanel + 12 abas + CatalogImportDialog + SMPTE tab + Group A safety hardening. O arquivo `src/pages/SkyCanvas.tsx` agora carrega tudo no novo dock, mas ainda **carrega ~150 linhas de código morto** (`Inspector`, `TimelineStrip`, `Row`) que foram substituídos pelas tabs. Também faltam três coisas que aparecem no plan.md como pendências reais: persistência local do show, mobile sheet switcher claro, e sincronia audio→Show3DEngine.

Vou agrupar em 4 lotes pequenos. Cada um é independente — paro entre lotes pra você revisar.

## Lote 1 — Limpeza de código morto em `SkyCanvas.tsx`

Remover:
- `function Inspector({ cap })` (linhas 293–353) — substituído por `InspectorCueTab/SceneTab/RenderTab`.
- `function Row({ k, v })` (355–361) — usado só pelo Inspector.
- `function TimelineStrip({ ... })` (367–470) — substituído por `TimelineStripView` + `TimelineCuesTab`.
- Imports órfãos: `Slider`, `Tabs/TabsList/TabsTrigger/TabsContent`, `ScrollArea`, `EffectLibrarySidebar`, `Sun`, `Camera`, `Activity` (se nenhum outro caller).

Ganho: ~160 linhas removidas, bundle do chunk SkyCanvas menor, leitura mais clara.

## Lote 2 — Persistência local do show (`fxk.skycanvas.show.v1`)

Hoje cues e duração se perdem em refresh. Adicionar:
- Hook `useSkyCanvasShowPersistence()` em `src/hooks/useSkyCanvasShowPersistence.ts`:
  - Lê `cueMarkers + duration + audioName` de `useProjectStore` com `subscribeWithSelector`.
  - Debounce 500ms → grava em localStorage `fxk.skycanvas.show.v1` (≤32KB, quota-safe).
  - Hidrata 1× no mount via `useProjectStore.getState().setCueMarkers/setDuration` (idempotente, não chama setPlaying).
- Toast discreto "Show salvo localmente" na 1ª gravação (sessão).
- Botão "Reset show" no Master Menu (`skyActions.ts`) ao lado de "Reset layout", com confirmação `window.confirm`.

Não persiste: playhead `currentTime`, `isPlaying`, áudio em si (só nome).

## Lote 3 — Mobile sheet switcher (chip bar)

Hoje `mobileActive` controla qual painel está aberto, mas a única forma de trocar é colapsar/expandir manualmente. Adicionar:
- Chip bar fixo no rodapé (acima do `MobileTransportFab`) só em `<md`:
  - 3 chips glass: BIBLIOTECA · INSPECTOR · TIMELINE.
  - Active chip: cyan-300 + ring; inactive: zinc-400 muted.
  - Click → `setMobileActive(key)` (já invalida os outros via `useEffect` existente).
- Componente isolado `<MobilePanelSwitcher active onChange />` em `src/components/skycanvas/MobilePanelSwitcher.tsx`.
- Z-index 50 (mesmo do FAB), `bottom-20` pra não colidir com o transport.

## Lote 4 — Show3DEngine ↔ audio clock sync no SkyCanvas

A memória `mem://funcionalidades/show3d-timeline-audio-sync` documenta o pipeline (`useAudioMasterClock → useProjectStore → engine.seek`), mas SkyCanvas v3 ainda usa um RAF próprio que avança `currentTime` (linhas 501–514). Isso compete com o relógio mestre quando há áudio carregado.

Mudança cirúrgica:
- Quando `audioName != null` E `peaks != null` → desativar o RAF local e plugar `useAudioMasterClock(audioElementRef)`.
- Manter o RAF atual como fallback (sem áudio → comportamento idêntico).
- Audio tag `<audio ref={audioRef} src={audioObjectUrl} />` invisível (criada quando `onPickAudio` faz decode); seu `play()/pause()` espelha `setPlaying`.
- Zero impacto em CommandBus/SafetyStateMachine (SkyCanvas é Plano Show, não Hardware).

## Resumo técnico

```text
SkyCanvas.tsx          -160 lines  (lote 1: dead code)
+useSkyCanvasShowPersistence.ts    (lote 2: localStorage)
+MobilePanelSwitcher.tsx           (lote 3: UX mobile)
SkyCanvas.tsx playback hook        (lote 4: audio master clock)
```

Nenhum lote toca: CommandBus, FieldBus, uiCommandGateway, SafetyStateMachine, workMode, fxk16Bridge, portRegistry, deviceAggregator. SkyCanvas continua plano Show puro (mem://arquitetura/v6-quatro-planos), SIM · ADVISORY preservado, E-STOP global continua roteando pra `/command`.

## Sequência de execução

1. Lote 1 (limpeza) — primeiro porque destrava leitura.
2. Lote 2 (persistência) — ganho imediato pro operador.
3. Lote 3 (mobile switcher) — paraleliza sem dependência.
4. Lote 4 (audio sync) — exige Show3DEngine montado + audio tag, mais cirúrgico.

Aprova para executar os 4 em sequência, ou prefere parar depois do lote 2?
