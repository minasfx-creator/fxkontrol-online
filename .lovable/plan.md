## Objetivo

Permitir **arrastar o playhead na timeline** (ruler/track) com o mouse/toque e ver o **SkyCanvas atualizando em tempo real** (drones, light points e explosões/shells) sem precisar dar Play.

## Diagnóstico atual

1. `Timeline.tsx` só tem **clique único** no track (`handleTrackClick` → `setCurrentTime`). Não existe `mousedown + mousemove + mouseup` para arrastar.
2. `PlayheadIndicator` (linha 1190) é puramente visual — não captura mouse.
3. O pipeline de tempo já funciona corretamente:
   - `setCurrentTime(t)` → `timelineClock.seek(t)` → `onChange` listener (store/useProjectStore.ts:510) → store atualiza → componentes re-renderizam.
   - `Canvas` está em `frameloop="always"` (default), `useFrame` roda continuamente mesmo pausado.
   - `DroneRendererSwitch` / `DroneChoreography` consomem `currentTime` da store ✅.
   - `TimelineEffects` (FireworkRenderer.tsx:1156) consome `currentTime` ✅.
   - `ShellExplosionManager` recebe `currentTime` como prop ✅.
4. **Mas**: `FireworkBurst.useFrame` calcula partículas usando `progress` (derivado de `currentTime`), e o efeito só é renderizado enquanto `currentTime` está dentro da janela `[startTime, startTime+totalDuration]`. Portanto **scrub instantâneo já vai funcionar para shells/drones assim que houver drag**.
5. Audio `AudioWaveform.tsx:255` já tem guard de 0.15s para não devolver o tempo antigo durante scrub ✅.

## Mudanças propostas

### 1. Drag-to-scrub no ruler e na faixa do playhead — `src/components/editor/Timeline.tsx`

Substituir o `onClick={handleTrackClick}` do scroll container por um par `onPointerDown`/`onPointerMove`/`onPointerUp` (Pointer Events para cobrir mouse + touch + caneta de uma vez):

- `onPointerDown`: capturar o ponteiro (`setPointerCapture`), calcular `time` a partir do clientX (mesma fórmula atual), chamar `setCurrentTime(time)`, marcar `scrubbingRef = true`. Salvar se `wasPlaying = isPlaying` e dar `pause()` (`timelineTransport.pause()`) durante o scrub para não brigar com lockstep.
- `onPointerMove`: se `scrubbingRef`, recalcular `time` e chamar `setCurrentTime(time)` a cada move (com `requestAnimationFrame` throttle para no máx. 1 update por frame).
- `onPointerUp`/`onPointerCancel`: liberar capture, `scrubbingRef = false`. Se `wasPlaying`, retomar com `timelineTransport.play()`. Aplicar `snapTimeToBeat` somente no release final (não a cada move) para feedback fluido + snap final preciso.
- `clearTimelineItemSelection()` continua sendo chamado no down se não houver shift/ctrl/meta.

Isto preserva o single-click (down+up no mesmo ponto) e adiciona o drag.

### 2. Tornar `PlayheadIndicator` arrastável — `Timeline.tsx`

Adicionar `pointer-events-auto` + `cursor-ew-resize` na haste do playhead (atualmente `pointer-events-none`) e plugar os mesmos handlers do item 1, para o operador poder agarrar a linha do playhead diretamente. A bolinha do topo ganha um “handle” maior (12px) para alvo confortável em mobile.

### 3. Garantir que o snap só ocorra em momentos certos

`snapTimeToBeat` hoje é aplicado a cada clique. Durante drag isso causa “stair-step” visual desagradável. Aplicar:
- Sem snap durante `pointermove` (movimento contínuo).
- Snap no `pointerup` (commit final).

### 4. Auto-pause durante scrub (qualidade de vida)

Quando o operador começa a arrastar enquanto está tocando, pausar via `timelineTransport.pause()` no `pointerdown` e retomar no `pointerup` se estava tocando. Evita que o lockstep playback continue avançando junto e crie corrida.

### 5. Sem mudanças necessárias em SkyCanvas / FireworkRenderer / ShellExplosionManager / DroneChoreography

Esses já reagem a `currentTime` via store. A correção é puramente de input no Timeline.

## Detalhes técnicos

- Pointer Events (`onPointerDown` etc.) cobrem mouse, touch e Apple Pencil em um só handler — evita duplicar `touchstart`/`mousedown` como o `TimelineScrubber` faz.
- Throttle por `requestAnimationFrame`: guardar `pendingTimeRef`; no rAF callback chamar `setCurrentTime(pendingTimeRef.current)`. Cancelar rAF no unmount/up.
- Não tocar em `timelineClock.ts` nem no listener de `useProjectStore.ts:510` — eles já propagam `seek` corretamente (`lastPositionChange = 'seek'` força `notify()`).
- `PlayheadIndicator` precisa receber `scrollRef` ou usar `getBoundingClientRect` da própria haste para calcular delta — preferir reutilizar o handler global do scroll container e deixar a haste apenas passar o evento (sem `stopPropagation`).
- Manter `touch-action: none` no scroll container para prevenir scroll horizontal do navegador durante o drag em mobile.

## Arquivos modificados

- `src/components/editor/Timeline.tsx` — refatorar `handleTrackClick` em `handlePointerDown/Move/Up`, ajustar `PlayheadIndicator` para ser arrastável, adicionar `touch-action: none`.

## Critério de aceite

- Arrastar a régua/playhead com mouse: drones se movem para a formação correspondente em tempo real, shells aparecem/desaparecem na janela `[startTime, startTime+duration]` enquanto o cursor passa, light points atualizam.
- Em mobile (touch), mesmo comportamento sem trigger de scroll horizontal.
- Single-click continua pulando para o instante (snap-to-beat aplicado).
- Se estava tocando, pausa automaticamente ao começar drag e retoma ao soltar.
- Sem regressões em: marquee de seleção, drag de itens, resize de itens, atalhos de teclado.
