

# Plan: Menu Fullscreen com Todas as Funcionalidades por Categorias

## Objetivo
Criar um overlay fullscreen (Command Center) ativado por um botão na Toolbar, exibindo todas as funcionalidades do editor organizadas por categorias com UI/UX premium — busca instantânea, ícones, descrições, atalhos de teclado, e navegação por categorias na sidebar.

## O que será implementado

### 1. Componente `FullscreenCommandMenu`
**Criar: `src/components/editor/FullscreenCommandMenu.tsx`**

Overlay fullscreen (`fixed inset-0 z-[100]`) com backdrop blur e animação de entrada/saída:

```text
┌──────────────────────────────────────────────────────┐
│  [X]                   FX KONTROL                    │
│  ┌──────────────────────────────────────────────┐    │
│  │ 🔍 Buscar funcionalidade...          Esc     │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ┌─────────┐  ┌──────────────────────────────────┐   │
│  │ Sidebar │  │  Grid de itens da categoria      │   │
│  │         │  │                                   │   │
│  │ 📍 Pos  │  │  [icon]  [icon]  [icon]  [icon]  │   │
│  │ 📝 Scr  │  │  Label   Label   Label   Label   │   │
│  │ 🎭 Cor  │  │  desc    desc    desc    desc    │   │
│  │ 🔌 Con  │  │                                   │   │
│  │ 🚁 Dro  │  │  [icon]  [icon]  [icon]  [icon]  │   │
│  │ 📦 Hdw  │  │                                   │   │
│  │ 📊 Rel  │  │                                   │   │
│  │ 🌍 Cen  │  │                                   │   │
│  └─────────┘  └──────────────────────────────────┘   │
│                                                      │
│  ── Recentes ──────────────────────────────────────  │
│  [chip] [chip] [chip]                                │
└──────────────────────────────────────────────────────┘
```

Funcionalidades:
- **Sidebar de categorias** (8 categorias do SECTIONS existente no MobileMoreMenu) — hover/click filtra o grid
- **Busca em tempo real** — filtra por nome/label em todas as categorias
- **Grid de itens** — cards com ícone grande, label, descrição curta e atalho (se existir)
- **Recentes** — últimos 5 painéis abertos (localStorage)
- **Atalho Ctrl+K** para abrir/fechar
- **ESC** para fechar
- Reutiliza o array SECTIONS do PanelTabBar (mesma fonte de dados)
- Ao clicar num item, chama `onOpenPanel(id)` e fecha o menu

### 2. Integração na Toolbar
**Editar: `src/components/editor/Toolbar.tsx`**

- Adicionar botão com ícone `LayoutGrid` ou `Command` entre os menus e o timecode
- State `commandMenuOpen` + renderizar `<FullscreenCommandMenu />`
- Atalho global `Ctrl+K` para toggle

### 3. Atalho Global
**Editar: `src/components/editor/Toolbar.tsx`**

Adicionar `Ctrl+K` no handler de keyboard existente para abrir o command menu.

## Detalhes Técnicos

- Dados vêm do `PANEL_SECTIONS` já definido em `PanelTabBar.tsx` (exportar o array)
- Descrições curtas adicionadas inline no novo componente (1 linha por item)
- Animação: `animate-in fade-in zoom-in-95` do Tailwind
- Recentes salvos em `localStorage` key `fxk-recent-panels`
- Responsivo: em mobile o sidebar de categorias vira tabs horizontais scrolláveis no topo

## Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/editor/FullscreenCommandMenu.tsx` | Criar |
| `src/components/editor/PanelTabBar.tsx` | Editar — exportar PANEL_SECTIONS |
| `src/components/editor/Toolbar.tsx` | Editar — botão + state + Ctrl+K |

