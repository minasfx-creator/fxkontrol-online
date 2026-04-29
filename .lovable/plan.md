## Objetivo

Tornar drag-and-drop de blocos da timeline previsível, com snapping consistente à grade (beats e/ou frames), zoom que altera a precisão do snap em pixels-constantes, e atalhos de teclado para nudge fino e zoom. Hoje:

- Snapping só age em **drop** (item novo) e em **drag de item existente**, e somente para **beats** (precisa de BPM) e bordas adjacentes — **não há snap em frames** (necessário em projetos pirotécnicos sem BPM).
- O threshold de snap é fixo em pixels (`8 / pixelsPerSecond`), o que é correto, mas o operador não tem modo "force snap" (Shift/Alt) nem como **desabilitar momentaneamente** o snap durante um drag.
- Não há atalhos para nudge (mover seleção 1 frame / 1 beat por vez) nem para zoom (`Ctrl +/-`, `Ctrl 0`).
- Sem feedback visual da grade-de-frames ao dar zoom in profundo.

## Mudanças propostas

### 1. Grade unificada beats + frames + segundos

**Novo helper** `src/components/editor/timelineGrid.ts`:

- `getActiveGrid({ bpm, snapMode, fps, pixelsPerSecond })` retorna `{ unit: 'beat'|'frame'|'second', interval: number, subdivisions: number[] }` decidindo automaticamente a unidade ativa:
  - `snapMode === 'beat'` e `bpm > 0` → unit beat (interval = 60/bpm).
  - `snapMode === 'frame'` → unit frame (interval = 1/fps, fps lido de `timecodeProvider.getFPS()`).
  - `snapMode === 'off'` → sem snap.
  - `snapMode === 'auto'` (novo padrão): beat se `bpm > 0`, senão frame.
- `snapTime(time, grid, pixelsPerSecond, threshold = 8)` substitui `snapTimeToBeat` e `resolveDropTime`'s lógica de beat — única função de snap-grid usada em todo o `Timeline.tsx`.
- `quantizeTime(time, grid)` (sem threshold — força snap, usado por nudge de teclado).
- `getSubdivisions(grid, viewport, pixelsPerSecond)` decide automaticamente densidade de linhas: ao dar zoom in suficiente para ≥ 12 px por frame, mostra grid de frames; caso contrário, beats; caso contrário, segundos.

### 2. Estado + UI: `snapMode` (`auto | beat | frame | off`)

**Loja** (`useProjectStore`): adicionar campo `snapMode: 'auto' | 'beat' | 'frame' | 'off'` (default `'auto'`). Migrar campo legado `snapToBeat` → `snapMode = snapToBeat ? 'auto' : 'off'` no `partialize`/migrate (mantém compat com projetos salvos).

**Toolbar Timeline** (`Timeline.tsx`, perto do botão `Magnet` em ~linha 1602): substituir o toggle único por um pequeno segmented control de 4 estados (Auto / Beat / Frame / Off) com tooltip explicando que "Auto = beat se BPM, senão frame". O `Magnet` permanece como ícone do grupo.

### 3. BeatGrid → TimelineGrid (renderiza beats OU frames OU segundos)

Renomear `BeatGrid` para `TimelineGrid` e renderizar a partir de `getSubdivisions(...)`. Manter virtualização atual (buffer 200 px). Usar 3 níveis de opacidade:

- Linha de unidade principal: `opacity 0.4`.
- Linha de subdivisão (½, ¼ no caso de beat; 6 frames no caso de frame): `opacity 0.18`.
- Compass/segundo cheio: `opacity 0.6`.

Não tocar no `TimeRuler` — segue lógica de segundos atual.

### 4. Snap durante drag de item existente

Em `handleItemDragStart` (linha 505) e em `EffectBlockRow` resize (linha 236), substituir:

```ts
newTime = snapTimeToBeat(newTime, bpm, snapToBeat, pixelsPerSecond);
```

por:

```ts
const grid = getActiveGrid({ bpm, snapMode, fps, pixelsPerSecond });
const forceSnap = me.shiftKey;       // Shift = força quantização no centro da grade
const disableSnap = me.altKey;        // Alt = move livre, ignorando snap
newTime = disableSnap ? newTime
        : forceSnap   ? quantizeTime(newTime, grid)
                      : snapTime(newTime, grid, pixelsPerSecond);
```

A mesma lógica vai para o resize handle (linha 236) e para o drop handler (linha 462) — todos passam a usar o mesmo `getActiveGrid`/`snapTime`.

O snap edge-to-edge (item adjacente) já existente é preservado e roda **depois** do snap-grid; o último vencedor define o `SnapReason` mostrado no preview.

### 5. Atalhos de teclado

Adicionar ao `handleKeyDown` da Timeline (linha 1348), só ativos quando `selectedTimelineItemIds.length > 0` ou `selectedTimelineItemId` existe **e** o foco não está em um input:

| Atalho | Ação |
|---|---|
| `←` / `→` | Nudge 1 unidade da grade (1 beat ou 1 frame conforme `snapMode`/`bpm`) |
| `Shift + ←` / `Shift + →` | Nudge 1 segundo |
| `Alt + ←` / `Alt + →` | Nudge 1 frame (sempre frame, ignora `snapMode`) |
| `Ctrl/Cmd + ←` / `→` | Snap exato à unidade da grade (quantize) |
| `Ctrl/Cmd + +` / `=` | Zoom in (centrado no playhead) |
| `Ctrl/Cmd + -` | Zoom out (centrado no playhead) |
| `Ctrl/Cmd + 0` | Zoom para fit (viewport inteiro mostra `duration`) |
| `[` / `]` | Diminuir / aumentar `pixelsPerSecond` em passos discretos (4, 8, 15, 25, 40, 60, 80) |

Os zoom shortcuts reutilizam o cálculo de "preserva ponto sob playhead" já presente no wheel handler (linha 1326-1338).

Nudge implementado via `updateTimelineItem` em todos os ids selecionados; se múltiplos itens, todos movem o mesmo delta (não cada um para sua grade individual — operadores esperam movimento solidário).

### 6. Modificadores Shift / Alt durante drop

No `handleDrop` (linha 447) e `handleDragOver` (linha 425), passar `e.shiftKey` e `e.altKey` para `resolveDropTime` e propagar para o `snapTime`/`quantizeTime` em `timelineDropFx.ts`. Atualizar a interface `ResolveDropTimeArgs` com `forceSnap?: boolean; disableSnap?: boolean`.

A pílula de `SnapReason` na preview ganha um ícone extra quando `forceSnap` está ativo ("⇥ FORCE") ou `disableSnap` ("✕ FREE").

### 7. Indicador de unidade ativa

Pequeno chip ao lado do controle `snapMode`: `BEAT 120 BPM`, `FRAME 30 fps`, `OFF`, ou `AUTO → BEAT/FRAME`. Texto `text-[10px]` no estilo Mission Control existente.

## Detalhes técnicos

- `fps` vem de `timecodeProvider.getFPS()` (default 60). Se o projeto tem SMPTE configurado em outro framerate, `timecodeProvider` já reflete. Não estamos introduzindo novo estado; só lendo.
- `snapMode` persistido via Zustand persist (já há partialize). Migration:
  ```ts
  migrate: (persisted, version) => {
    if (version < N) {
      return { ...persisted, snapMode: persisted.snapToBeat === false ? 'off' : 'auto' };
    }
    return persisted;
  }
  ```
- A função `snapTimeToBeat` antiga é apagada; todas as 8 chamadas migradas para `snapTime`. Isso elimina drift entre track rows que reimplementaram a mesma lógica.
- Threshold em pixels constante (`8 px`) garante que ao dar zoom in o snap fica mais permissivo em unidades de tempo (mais granular), exatamente o que se espera para "ajuste fino com zoom".
- Em `getSubdivisions`, quando `1/fps * pixelsPerSecond >= 12`, ativa subdivisão de frames; quando `beat * pixelsPerSecond >= 18`, mostra ¼ beats. Sempre virtualizado pela janela visível.
- Atalhos não conflitam com `useKeybindings.ts` (arrow keys e `[]` não usados; `Ctrl+0/+/-` não usados — `Ctrl+a/c/v/d` são preservados).
- Espaço continua reservado ao `useKeybindings` global (play/pause).

## Critério de aceite

- Drag de item existente em projeto **sem BPM** snapa para frames quando `snapMode = auto` ou `frame`.
- Em projeto com BPM, drag snapa para beats (default), e mudando o controle para `frame` snapa para frames.
- Segurar **Shift** durante drag força snap exato (quantize); segurar **Alt** desativa snap (movimento livre).
- `Ctrl + +` e `Ctrl + -` dão zoom in/out preservando o ponto do playhead sob o cursor virtual; `Ctrl + 0` faz fit.
- `←`/`→` movem a seleção exatamente uma unidade da grade; `Alt+←/→` movem 1 frame; `Shift+←/→` movem 1 segundo.
- Grade visual mostra frames automaticamente quando há zoom suficiente; senão beats; senão segundos.
- Projetos antigos (com `snapToBeat` salvo) carregam com `snapMode = auto` (se era true) ou `off` (se era false), sem perder configuração.
- Build OK, tests existentes passam, novos tests para `snapTime`/`quantizeTime`/`getActiveGrid` em `src/components/editor/__tests__/timelineGrid.spec.ts` passam.

## Arquivos modificados

- **Novo**: `src/components/editor/timelineGrid.ts` — `getActiveGrid`, `snapTime`, `quantizeTime`, `getSubdivisions`.
- **Novo**: `src/components/editor/__tests__/timelineGrid.spec.ts`.
- `src/store/useProjectStore.ts` — adicionar `snapMode`, migration de `snapToBeat`.
- `src/components/editor/Timeline.tsx` — remover `snapTimeToBeat` local, migrar todas as chamadas para `snapTime`/`quantizeTime`; renomear `BeatGrid` → `TimelineGrid`; adicionar atalhos de nudge/zoom; segmented control no toolbar.
- `src/components/editor/timelineDropFx.ts` — `resolveDropTime` aceita `forceSnap`/`disableSnap` e usa `snapTime` do helper novo.
- `src/components/editor/PyroTimelineTrack.tsx` (se usar snap próprio) — alinhar ao mesmo helper.
