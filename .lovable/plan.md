

## Plano: Ajuste UI/UX Mobile — Sidebar, Menus e Ferramentas Flutuantes Arrastáveis

### Problemas Identificados

1. **Nomes dos menus não aparecem na sidebar mobile** — O `SidebarProvider` usa `defaultOpen={!isMobile}`, resultando em `state="collapsed"` no mobile. O `AppSidebar` condiciona a exibição de texto com `{!collapsed && ...}`, escondendo todos os labels mesmo quando a sidebar abre como Sheet (offcanvas).

2. **Ferramentas do viewport não são reposicionáveis** — O `TacticalDock` (desktop) e `MobileQuickActions` (mobile) têm posição fixa, sem possibilidade de arrastar.

3. **Controles de viewport obstruem o canvas** — Posições fixas podem sobrepor conteúdo importante sem escape.

---

### Mudanças Planejadas

#### 1. Corrigir visibilidade dos nomes na sidebar mobile
**Arquivo:** `src/components/AppSidebar.tsx`

- Criar variável `showLabels` que é `true` quando no mobile (Sheet sempre mostra expandido) OU quando `state === 'expanded'` no desktop.
- Substituir todas as ocorrências de `!collapsed` por `showLabels`.
- Lógica: `const showLabels = isMobile || state === 'expanded';`

#### 2. Criar componente `DraggableFloatingPanel`
**Novo arquivo:** `src/components/editor/DraggableFloatingPanel.tsx`

- Wrapper genérico que permite drag-and-drop de posição via pointer events.
- Persiste posição no `localStorage` por `panelId`.
- Inclui grab handle visual (6 dots grip), botão minimizar/expandir.
- Snap to edges com magnetismo de 8px.
- Limita movimento dentro do viewport (bounds checking).
- Estilo glassmorphism consistente com o design system FUI.

#### 3. Envolver ferramentas do viewport em painéis flutuantes arrastáveis

**Arquivo:** `src/components/editor/TacticalDock.tsx`
- Envolver o dock em `DraggableFloatingPanel` com `panelId="tactical-dock"`.
- Posição inicial: left-center (como atual).

**Arquivo:** `src/components/editor/MobileQuickActions.tsx`
- Envolver os dois grupos (edit actions + viewport nav) em `DraggableFloatingPanel` independentes.
- `panelId="mobile-edit-actions"` (esquerda) e `panelId="mobile-viewport-nav"` (direita).

**Arquivo:** `src/components/editor/ViewportNavControls.tsx`
- Envolver em `DraggableFloatingPanel` com `panelId="viewport-nav"`.
- Posição inicial: right-bottom (como atual).

#### 4. Revisão QA final de visibilidade
- Verificar que todos os labels da sidebar mobile (Dashboard, Command, Editor 3D, Agenda, Training, Field Test, Show Test, Pairing, PCB Viewer, Configurações, Admin) aparecem com texto legível.
- Confirmar que o DockBar mobile (bottom dock) tem labels truncados corretamente.
- Garantir que painéis flutuantes não cobrem a MobileTabBar (bottom: > 80px).

---

### Detalhes Técnicos

```text
DraggableFloatingPanel
├── State: { x, y } via useState + localStorage
├── Events: onPointerDown → track, onPointerMove → update, onPointerUp → persist
├── Bounds: clamp(0, window.innerWidth - panelWidth)
├── Props: panelId, initialPosition, children, minimizable
└── Render: div[position:fixed, left/top from state, z-40]
     ├── GripHandle (drag target)
     └── {children}
```

### Ficheiros Afetados
1. **Modificar** `src/components/AppSidebar.tsx` — fix label visibility on mobile
2. **Criar** `src/components/editor/DraggableFloatingPanel.tsx` — generic draggable wrapper
3. **Modificar** `src/components/editor/TacticalDock.tsx` — wrap in draggable
4. **Modificar** `src/components/editor/MobileQuickActions.tsx` — wrap groups in draggable
5. **Modificar** `src/components/editor/ViewportNavControls.tsx` — wrap in draggable

### Proteções
- Sidebar desktop (icon collapsible) — intacto
- DockBar (bottom dock) — intacto
- MobileTabBar / MobileFloatingPanel — intactos
- Stores Zustand — intactos
- SkyCanvas / Three.js — intacto

