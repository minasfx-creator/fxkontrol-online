
## Plano: Otimizar Editor 3D — Timeline e Limpeza UI

### Problemas Identificados

**1. Timeline desktop começa recolhida (32px)** — O estado inicial `timelineCollapsed` não é definido no código visível, provavelmente começa como `false` mas a timeline de 25vh pode ser excessiva. O botão de expandir/recolher é pequeno e difícil de encontrar.

**2. Hardcoded colors no desktop layout** — Linhas 450-577 usam cores hardcoded (`bg-zinc-950`, `text-zinc-500`, `bg-zinc-800/90`, `rgba(9, 9, 11, ...)`) em vez de semantic tokens do design system.

**3. ViewportNavControls inline** — O componente (linhas 186-220) está definido inline no Index.tsx (arquivo de 607 linhas). Deveria ser extraído.

**4. MobileQuickActions referenciado mas não verificado** — Componente lazy carregado sem validação se é redundante com MobileTabBar.

**5. Redundância nos dock/sidebars laterais (desktop)** — Left dock (effects/scene/settings) + Right dock (PanelTabBar) ambos com lógica de floating panels quase idêntica.

---

### Correções Prioritárias

**Arquivo 1: `src/pages/Index.tsx`** — Limpeza de cores hardcoded
- Substituir `bg-zinc-950` → `bg-background`
- Substituir `text-zinc-500` → `text-muted-foreground`
- Substituir `text-zinc-400` → `text-muted-foreground`
- Substituir `hover:text-zinc-300` → `hover:text-foreground`
- Substituir `bg-zinc-800/90` → usar `bg-muted/90`
- Substituir `rgba(9, 9, 11, ...)` inline styles → CSS variables

**Arquivo 2: `src/pages/Index.tsx`** — Extrair ViewportNavControls
- Mover componente ViewportNavControls para `src/components/editor/ViewportNavControls.tsx`
- Reduzir tamanho do Index.tsx

**Arquivo 3: `src/pages/Index.tsx`** — Melhorar timeline visibility
- Aumentar o botão toggle da timeline (de w-11 h-5 para w-14 h-6)
- Adicionar label textual "Timeline" ao lado do chevron quando expandida
- Garantir que timeline inicia EXPANDIDA por default no desktop

### Arquivos modificados: 2 (Index.tsx + novo ViewportNavControls.tsx)
