

# XL4 2.0 — Separação Execução vs Editor + Controllers no Dashboard + Apple Glassmorphism

## Arquitetura Atual (Problemas)

O `LiveFiringPanel` (1415 linhas, 21 modos) vive dentro do Editor 3D (`/editor`), misturando sistemas de **execução ao vivo** (disparo, módulos, hardware) com **editores de coreografia** (timeline, script, efeitos). Isso causa:
- Lentidão: carregar o editor 3D só para disparar
- Confusão UX: operador de show não precisa do viewport 3D
- Dashboard sem acesso direto a controladores

## Plano

### 1. Nova Rota `/command` — Centro de Comando Separado

Criar `src/pages/CommandCenter.tsx` — página dedicada para **execução ao vivo**, sem viewport 3D:
- Acesso direto a todos os modos de execução (Super DMX, Pyro XL4, Auto Fire, Manual Fire)
- Hardware Hub (Controllers, PBUS, ArtNet, Radio, IFM, WiFi Direct)
- Connections, Field Map, Mobile Link
- Visual Apple glassmorphism: glass-hud backgrounds, rounded-2xl cards, Dynamic Island status
- Layout: sidebar de modos à esquerda (desktop) ou segmented control (mobile) + conteúdo central

O `LiveFiringPanel` continua existindo como componente mas será renderizado **tanto** no `/command` (fullscreen, standalone) **quanto** no `/editor` (como panel lateral, apenas modos de disparo).

### 2. Controllers no Dashboard

Adicionar seção **"Hardware Control"** ao Dashboard (`Dashboard.tsx`):
- Grid de cards glassmorphism com os 10 controladores do `VirtualControllerHub`
- Status de conexão live (FireOne, PBUS badges)
- Click navega direto para `/command?mode=pyro_fire` (ou o modo correspondente)
- Substituir o card "System Status" atual (que mostra tudo offline) por este grid real

### 3. Separação de Modos

**Modos de EXECUÇÃO** (vão para `/command`):
- `super_dmx`, `simple_dmx`, `manual_fire`, `pyro_fire`, `auto_fire`, `check_slave`
- `controllers`, `pbus`, `ma3`, `module`, `wifi_direct`
- `artnet_modules`, `connections`, `radio`, `field_map`
- `mobile_link`, `settings`

**Modos de DESIGN** (ficam no `/editor`):
- Timeline, Script, Effects, Storyboard, SwarmGPT, Templates
- Todos os painéis de coreografia existentes

### 4. Apple Glassmorphism no CommandCenter

- Background: gradient escuro com grain sutil
- Cards: `glass-card` com `backdrop-filter: blur(40px)`
- Mode selector: iOS segmented control com highlight animado
- Status bar: Dynamic Island pill com timecode + ARM state + connections count
- PANIC button: rounded-2xl, gradient vermelho sutil, glow on hover
- Tipografia: Outfit para headers, JetBrains Mono para dados, mínimo 9px

### 5. Sidebar — Adicionar rota Command Center

Adicionar item "Command" à `AppSidebar` com ícone `Crosshair` ou `Radio`, entre Dashboard e Editor.

## Arquivos

1. **Novo**: `src/pages/CommandCenter.tsx` — página standalone de execução com glassmorphism
2. **Editar**: `src/pages/Dashboard.tsx` — substituir System Status por grid de controllers com navegação para `/command`
3. **Editar**: `src/App.tsx` — adicionar rota `/command`
4. **Editar**: `src/components/AppSidebar.tsx` — adicionar item Command Center
5. **Editar**: `src/components/editor/LiveFiringPanel.tsx` — extrair renderização para ser reutilizável no CommandCenter

