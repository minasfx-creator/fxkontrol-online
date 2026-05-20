## Escopo

A barra lateral direita do `/editor` (`src/components/editor/PanelTabBar.tsx`) tem ~80 painéis distribuídos em 10 seções, sem glass, com muitos itens duplicados entre seções, e o `ScrollArea` existe mas o card pai usa `flex-col` sem `min-h-0` — em telas baixas o scroll engasga. Vou tratar só esse componente, sem mexer no resto do editor.

## Mudanças

### 1. Scroll real (fix do ScrollArea)
- Adicionar `min-h-0 h-full` no container raiz (hoje `flex flex-col` sem min-h, o que faz o `ScrollArea flex-1` colapsar em viewports curtos).
- `ScrollArea` ganha `h-full` explícito + viewport `overscroll-contain`.
- Header (Search) e Favoritos viram `flex-shrink-0`; só a lista de seções rola.

### 2. Glassmorphism (alinhado ao header do MainLayout)
- Substituir `style={{ background: 'hsl(var(--card))' }}` por:
  - `background: rgba(8, 10, 14, 0.72)`
  - `backdrop-filter: blur(32px) saturate(1.6)` (+ `-webkit-`)
  - `border-l: 1px solid hsl(var(--primary) / 0.08)`
  - Inner highlight `box-shadow: inset 1px 0 0 rgba(255,255,255,0.04)`
- Tokens canônicos preservados (Vantablack + cyan-dessat). Sem `#00FFFF`/laranja-CTA (memória de design).

### 3. Deletar UI redundante (PANEL_SECTIONS)
Removo itens duplicados/sobrepostos mantendo a entrada mais específica de cada conceito:

| Removido | Motivo / Onde fica |
|---|---|
| Comando · `showcommander` duplicação | mantém só na seção ★ Comando, remove sombra "Show Control" duplicada no Drone (`showcontrol` vira atalho da mesma página) — **mantenho `showcontrol` (Drone) e removo `showcommander` da seção Comando** porque a seção ★ Comando inteira é redundante com o DockBar global ✗ → **remove a seção `★ Comando` inteira** |
| Conexões · `mavlink` | duplicado com Drone (telemetria/flight) ✗ |
| Conexões · `mobilelink`, `linkmonitor` | sobrepostos com `easyconnect` + `usb` ✗ |
| Conexões · `remotecontrol` | sobreposto com `showcontrol` (Drone) ✗ |
| Conexões · `diagnostic` | move-se para Relatórios (`qastudio` cobre) ✗ |
| Hardware · `connections` | duplica "Conexões" inteira ✗ |
| Hardware · `radio` | já existe `radio` em Conexões? não — **mantém** |
| Coreografia · `boids` | sobreposto com `trajectory` ✗ |
| Cena · `particles` | dev-only, mover p/ rota `/dev` (remove do tab bar) ✗ |
| Relatórios · `aroverlay` | marketing-only, remove ✗ |

Total: **9 entradas removidas** + **1 seção removida** (`★ Comando` consolidada em DockBar global / `showcontrol`). Imports do lucide ficam, pois alguns ícones são reusados.

Painéis removidos do tab bar continuam acessíveis pelo `FullscreenCommandMenu` (Cmd+K) — nada quebra, só some do rail.

### 4. Verificação
- `bunx vitest run src/components/editor/__tests__` se existirem testes do PanelTabBar (nenhum hoje, então só typecheck via build).
- Visual: abrir `/editor`, confirmar scroll com viewport 800px, glass visível, sem itens duplicados.

## Fora do escopo
- `AppSidebar`, `MainLayout`, `UnifiedPanelMenu`, `MobileTabBar` (mobile usa outro componente).
- Refatorar `PANEL_SECTIONS` para fonte externa.
- Remover rotas/páginas dos painéis dropados (só somem do rail).

## Arquivos tocados
- `src/components/editor/PanelTabBar.tsx` (único)
