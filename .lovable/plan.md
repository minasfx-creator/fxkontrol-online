
Objetivo: unificar playback em um único clock canônico para que timeline, simulação, replay, SMPTE futuro e scheduler avancem no mesmo tempo determinístico, sem depender de delta do renderer.

1. Consolidar a fonte de verdade do tempo
- Criar `src/core/timeline/TimelineClock.ts` como relógio canônico do show, com API mínima:
  - `play()`, `pause()`, `seek(t)`, `setSpeed(speed)`, `setDuration(d)`, `setLoop(loop)`
  - `getTime()`, `getState()`, `isPlaying()`
  - `tick(dt)` para avanço determinístico por fixed-step
  - `syncExternalTime(t)` reservado para SMPTE/audio
  - `onChange(cb)` para UI e subsistemas observarem o mesmo estado
- Não usar `requestAnimationFrame` para avançar tempo lógico; RAF só pode servir para renderizar/escutar estado.

2. Eliminar a dupla autoridade atual
- Hoje existem dois caminhos de tempo:
  - `timelineEngine` em `src/core/engine/timelineEngine.ts`
  - playback em `src/components/editor/SkyCanvas.tsx` via `deterministicClock + lockstep + setCurrentTime`
- Refatorar para um único núcleo:
  - promover `TimelineClock` como engine central;
  - transformar `timelineEngine` em adapter fino ou removê-lo gradualmente;
  - remover a lógica de avanço direto de `currentTime` no `PlaybackClock` de `SkyCanvas.tsx`.
- Resultado: `useProjectStore.currentTime` vira espelho de UI do clock, não motor de tempo.

3. Integrar o clock ao lockstep existente
- Manter `deterministicClock` e `lockstep` como infraestrutura de fixed-step.
- Registrar o `TimelineClock` como primeiro subsystem do lockstep, antes de execution/simulation:
```text
DeterministicClock -> Lockstep -> TimelineClock -> Simulation/Execution -> Renderer
```
- Ordem sugerida:
  - `timelineClock` prioridade 0
  - `simulation/executionBridge` depois
  - replay/scheduler consumindo `timelineClock.getTime()` / tick atual

4. Sincronizar store/UI sem reintroduzir drift
- Criar `src/hooks/useTimelineClock.ts` como bridge React para ler e comandar o clock.
- O hook não deve criar clock novo; deve consumir singleton.
- O hook deve:
  - assinar `onChange`
  - expor `time`, `playing`, `duration`, `speed`
  - expor `play/pause/seek`
- Atualizar `usePlaybackState()` em `src/hooks/useEditorUI.ts` para usar o clock como backend do playback.
- Sincronizar `useProjectStore` a partir do clock:
  - `currentTime <- TimelineClock.time`
  - `isPlaying <- TimelineClock.playing`
  - `duration/playbackSpeed` bidirecional com guardas anti-loop

5. Conectar comandos existentes ao novo clock
- Ajustar os pontos que hoje escrevem direto no store e/ou `timelineEngine`:
  - `src/utils/joiCommandExecutor.ts`
  - atalhos/toolbar/timeline controls
  - stop/rewind/play/pause em HUD overlays
- Regra:
  - ações de playback chamam `TimelineClock`
  - store é atualizado como reflexo
  - nunca “renderer delta -> store currentTime -> timeline”

6. Conectar simulação e execução ao mesmo tempo canônico
- Trocar consumidores que dependem só de `useProjectStore.currentTime` para derivarem do clock sincronizado, sem quebrar UI atual.
- Em especial:
  - `src/components/editor/SkyCanvas.tsx`
  - `src/components/editor/skycanvas/FireworkRenderer.tsx`
  - `src/components/editor/skycanvas/LightingSystem.tsx`
  - bridges de execução/scheduler já registradas no lockstep
- Onde houver lógica “active burst / elapsed / trigger window”, usar tempo vindo do clock sincronizado para manter render e firing alinhados.

7. Preparar replay e seek determinístico
- Integrar `src/core/engine/ReplayEngine.ts` ao clock:
  - pause do clock ao iniciar replay/manual seek
  - `seek()` deve resetar tempo lógico e alinhar `deterministicClock`
  - rollback/replay devem reaplicar estado e depois reposicionar `TimelineClock`
- Garantir que seek não deixe o renderer ou executionBridge “um frame atrás”.

8. Preparar SMPTE/audio sem acoplamento prematuro
- Conectar `TimelineClock` ao `src/core/time/timecodeProvider.ts` e `src/store/useSMPTEStore.ts` apenas no nível de interface:
  - modo local: clock livre
  - modo slave futuro: `syncExternalTime()`
- Isso evita ter `useSMPTEStore` escrevendo diretamente em `useProjectStore.currentTime` como caminho principal.

9. Validação do passo
- Confirmar estes cenários:
  - Play/Pause/Seek atualizam UI e simulação juntos
  - O tempo não avança se o renderer travar momentaneamente
  - Replay volta ao estado correto e continua do mesmo tempo
  - `FireworkRenderer` e `LightingSystem` leem o mesmo tempo observado na toolbar
  - `JOI`/atalhos/playback controls continuam funcionando
- Critério de aceite:
  - existe um único source of truth de tempo
  - nenhum subsistema crítico avança por `delta` visual do renderer
  - app permanece “simulation-first deterministic engine”

Arquivos principais
- Novo:
  - `src/core/timeline/TimelineClock.ts`
  - `src/hooks/useTimelineClock.ts`
- Refatorar:
  - `src/core/engine/timelineEngine.ts`
  - `src/components/editor/SkyCanvas.tsx`
  - `src/hooks/useEditorUI.ts`
  - `src/store/useProjectStore.ts`
  - `src/utils/joiCommandExecutor.ts`
  - `src/store/useSMPTEStore.ts`
  - consumidores de `currentTime` em render/simulation relevantes

Detalhes técnicos
- Não implementar o hook com RAF como motor de tempo; isso criaria outra fonte de verdade e manteria o problema.
- O projeto já possui infraestrutura útil (`deterministicClock`, `lockstep`); o passo correto é reposicionar o clock da timeline dentro dela, não adicionar um terceiro clock paralelo.
- `useProjectStore.currentTime` deve continuar existindo por compatibilidade de UI/export, mas como estado derivado do clock central.
- Esse passo desbloqueia corretamente:
  - replay determinístico
  - export VVIZ/JSON com timeline locked
  - SMPTE lock futuro
  - firing scheduler
  - command journal replay
  - multi-client sync
