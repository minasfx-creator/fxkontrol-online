

# Plano: Revisao Completa UI/UX Mobile

## Problemas Identificados (via analise de codigo)

### 1. Dashboard Mobile — Layout sobrecarregado
- Grid `grid-cols-1` empilha tudo verticalmente sem priorizacao
- Console Launcher cards (`min-w-[72px]`) ficam apertados no scroll horizontal
- HubCards (FXK-PYRO Hub, Master Editor) ocupam espaco excessivo com grid 3x3 de ferramentas
- TransportIndicator badges com texto `8px` sao dificeis de tocar
- Feed cards Instagram ocupam `aspect-[4/3]` — muito alto para 375px

### 2. Editor 3D Mobile — Sobreposicoes e conflitos
- `MobileHUD` (top) e `MobileQuickActions` (left/right) podem sobrepor ao rolar/arrastar
- `DraggableFloatingPanel` grip handle (`44px`) e grande demais para paineis pequenos — consome espaco visual
- `MobileFloatingPanel` bottom sheet com `bottom: calc(64px + env(safe-area-inset-bottom))` pode nao alinhar perfeitamente com `MobileTabBar`
- `MobileTabBar` com 8 tabs em scroll horizontal — dificil descobrir tabs ocultas

### 3. DockBar Mobile — Itens truncados
- Labels truncados a 5 chars (`item.label.slice(0, 5)`) perdem significado (ex: "Comma." para Command)
- Sem feedback visual de scroll horizontal disponivel
- Separador de 1px quase invisivel

### 4. FXKAssistant — Sidebar hologram no mobile
- Sidebar de 120px no modo expandido consome ~32% da largura de 375px
- Chat area fica com apenas ~220px, insuficiente para mensagens

### 5. AppSidebar Mobile — Sheet offcanvas
- Funciona bem (showLabels = true no mobile), sem problemas criticos

---

## Modificacoes Propostas

### A. Dashboard Mobile (`src/pages/Dashboard.tsx`)
1. Reduzir hero banner padding de `p-5` para `p-3` no mobile
2. Console Launcher: aumentar `min-w` para `80px`, adicionar scroll indicator dots
3. HubCards: mudar para lista compacta (1 coluna, icone + label + seta) em vez de grid 3x3
4. Feed cards: reduzir aspect ratio para `aspect-[16/9]` no mobile
5. Stats grid: manter `grid-cols-2` mas com padding reduzido
6. Esconder "Mobile Command" card duplicado (ja esta no Console Launcher)

### B. Editor Mobile (`src/pages/Index.tsx`)
1. Reduzir z-index conflicts: MobileHUD z-50, QuickActions z-35, FloatingPanel z-40, TabBar z-50
2. Adicionar `safeAreaTop` offset ao MobileHUD para evitar sobreposicao com notch

### C. DraggableFloatingPanel (`src/components/editor/DraggableFloatingPanel.tsx`)
1. Grip handle compacto: reduzir de `44px` para `32px` quando nao em drag
2. Adicionar indicador visual de "arrastavel" mais sutil (3 dots em vez de GripVertical)
3. Opacidade reduzida quando parado (0.85), opacidade total ao arrastar

### D. MobileTabBar (`src/components/editor/MobileTabBar.tsx`)
1. Adicionar fade gradient nas bordas para indicar scroll horizontal
2. Reduzir para 6 tabs visiveis, agrupar extras no "more"

### E. DockBar (`src/components/DockBar.tsx`)
1. Labels mobile: usar abreviacoes mais claras (Command→CMD, Training→Train, Editor 3D→Editor)
2. Aumentar touch target para `w-14 h-16` (era `w-12 h-14`)
3. Adicionar scroll fade indicators

### F. FXKAssistant — Hologram no Mobile
1. No mobile expandido: remover sidebar de 120px, manter hologram apenas no header (compacto)
2. Chat area usa largura total no mobile

### G. MobileFloatingPanel
1. Ajustar `bottom` para usar variavel CSS compartilhada com MobileTabBar height
2. Melhorar snap points: collapsed=0, peek=30%, half=50%, full=90%

---

## Ficheiros a Modificar

| Acao | Ficheiro |
|------|---------|
| Modificar | `src/pages/Dashboard.tsx` — layout mobile compacto |
| Modificar | `src/components/DockBar.tsx` — labels e touch targets |
| Modificar | `src/components/editor/DraggableFloatingPanel.tsx` — grip compacto |
| Modificar | `src/components/editor/MobileTabBar.tsx` — scroll indicators |
| Modificar | `src/components/editor/MobileFloatingPanel.tsx` — snap alignment |
| Modificar | `src/components/editor/MobileHUD.tsx` — safe area refinement |
| Modificar | `src/components/FXKAssistant.tsx` — remove sidebar on mobile |
| Modificar | `src/pages/Index.tsx` — z-index cleanup |

### Protecoes
- Desktop layout intacto em todos os componentes
- Stores Zustand sem alteracoes
- SkyCanvas/Three.js intacto
- Logica de persistencia localStorage mantida

