## Objetivo

Refinar a camada "Mission Control" do Studio (`/`, desktop). Três problemas concretos:

1. Menus do topo se encavalam (Master Menu pill sobrepõe o `Toolbar` e o `Studio ▼` flutuante).
2. UI antiga (rail fixo `PanelTabBar` e o branch `horizontal-top` da `ViewportSegmentToolbar`) ainda está no código, criando redundância visual mesmo gated por flag.
3. Timeline já recolhe, mas a alça vive no centro (briga com o play-head) e nenhum dos menus flutuantes pode ser arrastado.

Tudo isso é puramente layout / interação. **Nada toca** `ShowPlan`, `CommandBus`, `SafetyStateMachine`, viewport-tools registry ou plugins.

## Mudanças

### 1. Top bar sem encavalamento

```text
┌──────────────────────────────────────────────────────────────┐
│ [FXK logo]    [⌘ Master Menu]              [Studio ▼] [👤]   │  ← faixa única, h-12
└──────────────────────────────────────────────────────────────┘
   z-50          z-50 (mesmo plano)             z-50    z-50
```

- Manter apenas **uma** faixa superior (`Toolbar`, `h-12`) e mover o `MasterMenuFloat` para *dentro* dela (slot central), eliminando o `position: fixed; top-2 left-1/2; z-[70]` que hoje passa por cima de tudo.
- `MasterMenuFloat` vira um botão inline (mesma altura do Toolbar). Atalho `⌘M` preservado, palette continua igual (`FullscreenCommandMenu`).
- `UserAvatarFloat` muda de "bottom-right above timeline" para o **canto direito do Toolbar**, ao lado do Studio mode (popover de profile/sign-out preservado). O float bottom-right é removido — o avatar disputava espaço com `ViewportNavControls` e com o painel de tools verticais.
- Z-index padronizado: Toolbar e tudo que vive nela em `z-50`. Painéis flutuantes em `z-40`. Dock vertical de segmentos em `z-30`. Timeline em `z-30`. Modais (palette) em `z-[80]`.

### 2. Deletar UI antiga

- Remover **import e mount** de `PanelTabBar` em `src/pages/Index.tsx` (Layer 2 inteiro). O arquivo `PanelTabBar.tsx` permanece no projeto porque exporta `PANEL_SECTIONS` + tipo `PanelId` consumidos por `UnifiedPanelMenu` (mobile) e `MobileTabBar`. Apenas o **componente default** vira não-renderizado no desktop (já é o estado atual via flag, mas o gate condicional e a flag são removidos: comportamento passa a ser definitivo).
- Remover a flag `floating_chrome` de `src/lib/featureFlags.ts` — o novo layout vira o único caminho, simplificando os condicionais espalhados em `Index.tsx`.
- Remover o branch `'horizontal-top'` da `ViewportSegmentToolbar`: hoje só existe para o `ShowEngineHost` legacy. Ajustar o `ShowEngineHost` para sempre usar `vertical-right` no desktop (mobile já tem caminho próprio via `MobileTabBar`).
- Remover a "Layer 4: Left Foundation Rail" comment órfão e os condicionais `!floatingChrome` agora mortos.

### 3. Timeline retrátil polida

```text
                                                   ┌──────────┐
viewport ............................              │ ▾ Timeline│  ← alça migra para
─────────────────────────────────────              └──────────┘     o canto direito
| Timeline (drag-resize 4px no topo)                              da barra
─────────────────────────────────────
```

- Alça de collapse/reset migra de `left-1/2` (centro) para `right-3` na borda superior do bloco da timeline — afastada do play-head, igual ao mockup.
- Adicionar zona de hover de 4px no topo do bloco da timeline com `cursor: ns-resize` que aciona o drag-resize já existente (handler `handleTimelineResize*`). Hoje a zona não tem affordance visual.
- Estado collapsed continua persistido em `timelineViewState` (já existe). Adicionar persistência da **altura** (vh) quando o usuário arrasta — campo `timelineHeightVh` no mesmo `loadTimelineView/saveTimelineView`.
- Quando colapsada, a barra fica `h-7` (apenas a alça), liberando viewport.

### 4. Drag-and-drop dos menus flutuantes

Novo hook utilitário `src/components/editor/useDraggableFloat.ts`:

```ts
export function useDraggableFloat(opts: {
  id: string;                       // chave de persistência localStorage
  defaultPos: { x: number; y: number; anchor: 'tl'|'tr'|'bl'|'br' };
  handleSelector?: string;          // só elementos casando o seletor iniciam drag
  bounds?: 'viewport';              // clamp na janela
}): {
  ref: React.RefObject<HTMLDivElement>;
  style: React.CSSProperties;       // posição absoluta calculada
  dragHandleProps: { onPointerDown: ... };
  resetPosition: () => void;
};
```

Características:
- Pointer events (mouse + touch unificado), `setPointerCapture`.
- Dead-zone de 4px antes de iniciar drag (não interfere com clicks).
- Clamp dentro da viewport (5px de margem).
- Persiste posição em `localStorage` (`fxk:float-pos:<id>`); reset com double-click no handle.
- Snap-to-edge a 16px da borda (visual feedback discreto + persistência ancorada na borda mais próxima, sobrevive a resize de janela).

Aplicar em:
- **`ViewportSegmentToolbar`** (vertical-right): handle = a barrinha do topo (chevron). Default ancorado em `right`.
- **Floating panel ativo** (Layer 3 em `Index.tsx`, `420px` à direita): adicionar header `h-7` glass com ícone de grip (`GripVertical`) que serve de handle. Preserva botão `X` e conteúdo.
- **`StudioPromptModal`** e **`MasterMenu` palette**: ficam como estão (não são floats, são modais).
- **Timeline**: NÃO entra em DnD (ancorada por design, só resize vertical).
- **`UserAvatarFloat`**: deixa de ser float (vira inline no Toolbar), portanto não precisa de DnD.

Cada float ganha pequeno botão "Reset position" no menu de contexto (right-click no handle).

## Detalhes técnicos

**Arquivos novos**
- `src/components/editor/useDraggableFloat.ts` — hook de drag/persist/clamp/snap.
- `src/components/editor/FloatHandle.tsx` — header reutilizável (grip + close + reset).

**Arquivos editados**
- `src/pages/Index.tsx`
  - Remove `PanelTabBar` import + Layer 2 inteiro.
  - Remove uso de `floating_chrome` (sempre on).
  - Remove `UserAvatarFloat` do bottom-right (move para Toolbar).
  - Layer 3 (panel flutuante) recebe `useDraggableFloat({ id: 'panel-' + activePanel, ... })` + `FloatHandle`.
  - Layer 7 (timeline): alça vai para `right-3`; adiciona barra de hover-resize 4px no topo; persiste altura.
- `src/components/editor/Toolbar.tsx`
  - Adiciona slot central que renderiza `<MasterMenuFloat inline />` e slot direito com `<UserAvatarFloat inline />`.
- `src/components/editor/MasterMenuFloat.tsx`
  - Aceita prop `inline?: boolean`. Quando `true`: sem `fixed/z-[70]/top-2 left-1/2`, vira pill normal dentro do flow do Toolbar.
- `src/components/editor/UserAvatarFloat.tsx`
  - Mesma ideia: prop `inline`. Quando inline, sem `bottomOffset`/`fixed`.
- `src/features/viewport-tools/components/ViewportSegmentToolbar.tsx`
  - Remove branch `horizontal-top`.
  - Wrapper externo passa a usar `useDraggableFloat({ id: 'segment-dock', defaultPos: { anchor: 'tr', x: 12, y: 0.5 } })`.
  - Handle = botão chevron já existente.
- `src/components/show-engine/ShowEngineHost.tsx`
  - Drop do parâmetro `orientation` (sempre vertical agora) — ou aceita e ignora para evitar churn.
- `src/lib/featureFlags.ts`
  - Remove `floating_chrome` (cleanup).
- `src/lib/timelineViewState.ts`
  - Adiciona campo opcional `heightVh: number` ao `loadTimelineView/saveTimelineView`.

**Z-index canon (aplicado consistentemente)**
```
Toolbar / inline floats         z-50
Floating panel (Layer 3)        z-40
Segment dock (vertical)         z-30
Timeline                        z-30
ViewportNavControls             z-20
Modais (palette, prompts)       z-[80]
Toasts                          z-[90]
```

## Fora de escopo

- `ShowPlan`, `CommandBus`, `SafetyStateMachine`, validators, viewport-tools registry, plugins — intocados.
- Mobile shell — gated por `useIsMobile()`, sem mudança.
- Lógica de painéis individuais (effects, racks, addressing, DMX) — intocada.
- MVP 2 parte 2 (DMX patch UI + conflict checker) e MVP 3 (validators FireOne/Showven) — próximas etapas, não entram nesse refactor.

## Aceitação

- Topo do viewport mostra **uma única faixa** com `[FXK] [⌘ Master Menu] ……… [Studio ▼] [👤]`. Sem sobreposição visual, sem pills "voando" sobre o Toolbar.
- `PanelTabBar` legado some completamente do desktop (zero render). `floating_chrome` é removido como flag.
- Dock vertical PYRO/SFX/DRONES/LIGHT/DMX e o painel flutuante de qualquer painel aberto podem ser **arrastados** com pointer/touch, com snap-to-edge e posição persistida entre sessões. Right-click no handle reseta posição.
- Timeline: alça de collapse/reset no canto direito; banda 4px no topo com cursor `ns-resize` para drag-resize; altura persistida; collapsed → 28px de banda + alça.
- Sem regressões mobile (`useIsMobile()` continua entregando o `MobileTabBar` + `UnifiedPanelMenu`).
- Nenhuma chamada nova ao `commandBus` ou ao `ShowPlan`. Build limpo.
