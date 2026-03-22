

# ArtNet Link por Módulo + Latência Visual + Refinamento Mobile Live FX

## O que será feito

### 1. Botão ARTNET LINK individual em cada módulo (PyroFireOnePanel)
O botão já existe na `renderModuleSelector()` (linhas 782-796). Cada módulo conectado já tem um botão Globe que chama `handleModuleArtnetLink`. O que falta:
- Adicionar indicação de **latência em ms** ao lado do ícone Globe quando linkado
- Melhorar visibilidade do botão (atualmente muito pequeno em mobile)

**Mudanças em `PyroFireOnePanel.tsx`**:
- Adicionar estado `artnetLatencies` (`Map<number, number>`) que simula/mede ping por módulo
- Após link, iniciar polling de latência simulada (3-50ms range baseado no transporte)
- Exibir `Xms` ao lado do Globe em cada módulo linkado no seletor
- Aumentar tamanho do botão Globe individual em mobile (`p-2` ao invés de `p-0.5`)

### 2. Botão ARTNET LINK no ArtNetModulePanel (por módulo)
**Mudanças em `ArtNetModulePanel.tsx`**:
- Adicionar botão "LINK" em cada `ModuleCard` que chama `connectModule`/`disconnectModule`
- Exibir latência simulada ao lado do badge de conexão quando online
- Badge visual: Globe violeta + `Xms` quando linkado

### 3. Refinamento total do painel Live FX no mobile

O painel Live FX (LiveFiringPanel) no mobile ocupa tela inteira mas a navegação entre modos é difícil — são 15+ abas numa barra horizontal scrollável com texto tiny.

**Mudanças em `LiveFiringPanel.tsx`**:
- **Reorganizar modos em categorias** com seções visuais claras:
  - 🔥 **FIRE**: Super DMX, Simple, Manual, Pyro, Auto, Check
  - 🎛 **HARDWARE**: Controllers, PBUS, MA3, IFM, WFD
  - 🌐 **NETWORK**: ArtNet, Connections, Radio, Map
  - ⚙ **SYSTEM**: Mobile Link, Settings
- **Grid de ícones em mobile** ao invés de tabs horizontais scrolláveis — 2 colunas, ícones grandes (44px touch targets), labels claros
- **Swipe entre categorias** mantido
- **Quick-access bar** fixa no topo com os 4 modos mais usados (Super DMX, Pyro, ArtNet, Map)
- **Breadcrumb** mostrando categoria > modo atual

### 4. Melhorar MobileTabBar
- Adicionar badge de status no ícone Live FX (número de efeitos ativos)
- Garantir que o painel abre em fullscreen por padrão no mobile

## Arquivos afetados
1. **Editar**: `src/components/editor/live-firing/PyroFireOnePanel.tsx` — latência por módulo, botões maiores
2. **Editar**: `src/components/editor/live-firing/ArtNetModulePanel.tsx` — botão LINK + latência em cada card
3. **Editar**: `src/components/editor/LiveFiringPanel.tsx` — reorganizar navegação mobile com grid categorizado
4. **Editar**: `src/components/editor/MobileTabBar.tsx` — badge de status no Live FX

