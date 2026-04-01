

## Plano: Eliminar Redundâncias e Inconsistências Restantes

### Problemas Encontrados

**1. FXKAssistant renderizado DUAS VEZES** — `MainLayout.tsx` linha 201 + `Index.tsx` linha 604. Na rota `/editor`, ambas as instâncias são montadas simultaneamente, desperdiçando memória e potencialmente mostrando o assistente duplicado.

**2. Navegação inconsistente entre Sidebar e DockBar** — A Sidebar tem "Pairing" e "PCB Viewer" que o DockBar não tem. O DockBar tem "Field Test" que a Sidebar não tem. Usuário vê rotas diferentes dependendo de qual menu usa.

**3. Código morto no Header** — Linha 145: `isEditor ? 'h-8' : 'h-10'` — mas o header já está oculto quando `isEditor` é true (guarda na linha 143). O ternário nunca ativa `'h-8'`.

**4. PANIC FAB ternário redundante** — Linha 210: `bottom: isMobile ? '80px' : '80px'` — valores idênticos.

**5. DockBar duplicado** — Linhas 226-227: duas linhas renderizam `<DockBar />` separadamente (`showDock` e `showMobileDock`). Pode ser uma única linha.

**6. Icon size redundante no DockBar** — Linha 167: `isMobile ? "w-5 h-5" : "w-5 h-5"` — mesma classe em ambos os ramos.

---

### Correções

**Arquivo 1: `src/pages/Index.tsx`** — Remover `FXKAssistant` duplicado
- Remover import (linha 33) e renderização (linha 604). O MainLayout já monta globalmente.

**Arquivo 2: `src/components/AppSidebar.tsx`** — Sincronizar navegação com DockBar
- Adicionar "Field Test" (`/field-test`, icon `Activity`) ao array `navItems`
- Manter "Pairing" e "PCB Viewer" na Sidebar (rotas especializadas de hardware)

**Arquivo 3: `src/components/DockBar.tsx`** — Limpar redundâncias
- Linha 167: simplificar `"w-5 h-5"` (remover ternário)

**Arquivo 4: `src/layouts/MainLayout.tsx`** — Limpar código morto
- Linha 145: remover ternário morto, usar sempre `h-10`
- Linha 210: simplificar `bottom: '80px'` (remover ternário)
- Linhas 226-227: unificar em `{(showDock || showMobileDock) && <DockBar />}`

### Arquivos modificados: 4

