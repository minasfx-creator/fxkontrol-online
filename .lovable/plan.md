

# Ciclo #52 — Revisão de Acesso a Menus e Ferramentas no Mobile Viewport

## Problemas Identificados

| # | Problema | Local | Impacto |
|---|---------|-------|---------|
| 1 | **DraggableFloatingPanel grip handle (32px) muito pequeno para touch** — Apple HIG recomenda mínimo 44px. O grip com 3 dots é difícil de acertar com o dedo, especialmente nos painéis laterais de 9×9 e 11×11 | `DraggableFloatingPanel.tsx` L151 | **Alto** — usuários não conseguem reposicionar painéis |
| 2 | **MobileQuickActions e MobileHUD sobrepõem-se** — Edit actions no `initialY: 0.4 * innerHeight` colidem com o HUD top bar quando o painel flutuante está aberto em modo `half`. Sem lógica de auto-reflow quando bottom sheet sobe | `MobileQuickActions.tsx` L95, L122 | **Alto** — botões ficam inacessíveis sob o sheet |
| 3 | **RadialMenu não adaptado para touch** — Raio interno 42px e externo 110px são adequados para mouse mas os setores ficam pequenos demais no mobile (375px viewport). Sem fallback para tela pequena | `RadialMenu.tsx` L25-28 | Médio — menu radial difícil de usar |
| 4 | **Viewport nav (zoom/reset) duplicados** — `MobileQuickActions` inclui zoom+/zoom-/reset E `ViewportNavControls` renderiza os mesmos controles. No desktop apenas ViewportNavControls aparece, mas no mobile ambos podem coexistir | `MobileQuickActions.tsx` L86-90, `ViewportNavControls.tsx` | Médio — clutter visual |
| 5 | **Botões sem labels visíveis** — Todos os action buttons usam apenas ícones de 4px sem texto. Em telas touch, sem hover tooltip, o usuário não sabe o que cada botão faz | `MobileQuickActions.tsx` L97-111 | Médio — discoverability ruim |
| 6 | **MobileTabBar scrollable mas sem indicador visual de scroll** — 8 tabs numa barra que precisa scroll horizontal, mas nenhuma affordance mostra que há mais tabs à direita além do fade sutil | `MobileTabBar.tsx` L189-193 | Baixo |

## Implementação

### 1. DraggableFloatingPanel — Touch-friendly grip (`DraggableFloatingPanel.tsx`)

- Aumentar `min-h` do grip handle de 32px para 44px sempre (não só durante drag)
- Expandir touch target com padding transparente: `py-2` no grip container
- Adicionar visual feedback mais forte no drag: escala 1.05 e borda glow

### 2. MobileQuickActions — Auto-hide quando bottom sheet aberto (`MobileQuickActions.tsx`)

- Receber prop `panelOpen: boolean` (passado do Index.tsx quando `mobilePanelHeight !== 'collapsed'`)
- Quando `panelOpen`, aplicar `opacity-0 pointer-events-none translate-y-4` nos painéis flutuantes
- Transição suave de 200ms para não ser abrupto
- Atualizar `Index.tsx` para passar a prop

### 3. RadialMenu — Escalar raios no mobile (`RadialMenu.tsx`)

- Detectar `isMobile` via `useIsMobile()`
- No mobile: `INNER_R = 52`, `OUTER_R = 140`, `SUB_INNER_R = 146`, `SUB_OUTER_R = 210`
- Limitar posição do menu para não cortar nas bordas (clamp x/y com margin de 210px)

### 4. Remover viewport nav duplicado (`MobileQuickActions.tsx`)

- Eliminar o bloco `viewportActions` e o segundo `DraggableFloatingPanel` (mobile-viewport-nav)
- O ViewportNavControls já existe e cobre essa funcionalidade no desktop
- No mobile, integrar zoom/reset como ações secundárias no edit panel (aparece com long-press no botão de seleção)

### 5. Micro-labels nos botões de ação (`MobileQuickActions.tsx`)

- Adicionar `<span>` com label de 8px abaixo de cada ícone
- Aumentar botão de 11×11 para 12×14 (44×52px real) para acomodar label
- Layout: ícone centered + label abaixo, estilo igual ao MobileTabBar

### 6. Scroll indicator na TabBar (`MobileTabBar.tsx`)

- Adicionar seta animada `→` no edge direito quando scroll position < maxScroll
- Usar `onScroll` no nav container para detectar scroll position
- Fade out a seta quando usuário scrollou até o fim

## Arquivos Afetados

- `src/components/editor/DraggableFloatingPanel.tsx`
- `src/components/editor/MobileQuickActions.tsx`
- `src/components/editor/RadialMenu.tsx`
- `src/components/editor/MobileTabBar.tsx`
- `src/pages/Index.tsx` (passar prop panelOpen)

## Ordem de Execução

| Passo | Tarefa |
|-------|--------|
| 1 | Grip handle 44px + auto-hide quick actions |
| 2 | RadialMenu mobile scaling |
| 3 | Remover viewport nav duplicado + micro-labels |
| 4 | Scroll indicator na TabBar |
| 5 | Build verification |

