
## Plano: Limpar Cores Hardcoded e Redundância Residual no Editor

### Problemas Encontrados

**1. Cores hardcoded no `Index.tsx`** — 6 blocos usam `rgba(9, 9, 11, ...)` e `rgba(255,255,255,...)` inline em vez de CSS variables/semantic tokens. Os fallbacks de erro (linhas 135, 154, 175) usam `bg-zinc-950`, `text-white`, `text-zinc-500`.

**2. `border-white/5` no left dock header** (linha 529) — Deveria ser `border-border/10` para consistência com o design system.

**3. `bg-white/5` e `hover:bg-white/10`** (linha 484, close button) — Deveria usar `bg-muted/30` e `hover:bg-muted/50`.

**4. Left dock e right panel abrem `effects`, `scene`, `showsettings` independentemente** — Usuário pode abrir "Effects" no dock esquerdo E no painel direito ao mesmo tempo, mostrando conteúdo duplicado. Falta guarda para fechar o oposto.

**5. `ViewportPlaybackControls` no desktop sobrepõe a Timeline** — Quando a timeline está expandida (25vh), os playback controls ficam em `bottom-4` DENTRO do viewport, mas visualmente colapsam sobre o toggle da timeline. Já temos playback na própria Timeline.

---

### Correções

**Arquivo 1: `src/pages/Index.tsx`** — Substituir todas as cores hardcoded

| De | Para |
|---|---|
| `bg-zinc-950` | `bg-background` |
| `text-white` | `text-foreground` |
| `text-zinc-500` | `text-muted-foreground` |
| `border-cyan-400` | `border-primary` |
| `text-cyan-400` | `text-primary` |
| `rgba(9, 9, 11, 0.90)` | `hsl(var(--background) / 0.90)` |
| `rgba(9, 9, 11, 0.50)` | `hsl(var(--background) / 0.50)` |
| `rgba(9, 9, 11, 0.92)` | `hsl(var(--background) / 0.92)` |
| `rgba(255,255,255,0.06)` | `hsl(var(--border) / 0.3)` |
| `rgba(255,255,255,0.04)` | `hsl(var(--border) / 0.2)` |
| `bg-white/5` | `bg-muted/30` |
| `hover:bg-white/10` | `hover:bg-muted/50` |
| `border-white/5` | `border-border/10` |

**Arquivo 2: `src/pages/Index.tsx`** — Fechar dock oposto ao abrir painel

Quando `setActivePanel` é chamado via right dock, fechar `leftDockOpen` se o ID for o mesmo (`effects`, `scene`, `showsettings`). Vice-versa: quando `setLeftDockOpen` é ativado, fechar `activePanel` se for o mesmo ID.

**Arquivo 3: `src/components/editor/SkyCanvas.tsx`** — Remover `ViewportPlaybackControls` do desktop

O componente é redundante com a Timeline (que já tem controles de playback). Remover a renderização na linha 1701 (`{!isMobile && <ViewportPlaybackControls />}`). O componente interno pode permanecer como código caso seja reutilizado.

### Arquivos modificados: 2
- `src/pages/Index.tsx` — theming semântico + guarda de painéis duplicados
- `src/components/editor/SkyCanvas.tsx` — remover ViewportPlaybackControls redundante
