
# XL4 2.0 — Redesign Command Center + Consoles Dedicados (Mobile & Desktop)

## Problemas Atuais

1. **Command Center genérico**: Todos os 17 modos usam o mesmo `LiveFiringPanel` sem diferenciação visual — Super DMX, Pyro XL4, Manual Fire, Auto Fire todos parecem iguais
2. **Tipografia ilegível**: Ainda existem 125+ ocorrências de `text-[5px]`/`text-[6px]` em `DeviceLibraryPanel`, `AutoFirePanel`, `WiFiDirectControlPanel`, `CheckSlavePanel`
3. **Mobile Command Center**: Funciona mas o layout é básico — pills + LiveFiringPanel sem chrome dedicado por console
4. **Desktop sidebar**: Funcional mas todos os modos misturados numa lista plana sem separação visual forte entre Fire Control vs Hardware vs Network
5. **LiveFiringPanel monolítico**: 1415 linhas com 21 modos roteados por switch — difícil manter e cada modo herda o mesmo chrome (status bar, arm bar, cue keys, panic) mesmo quando não precisa (ex: Settings, Field Map, Controllers não precisam de ARM/PANIC)

## Plano de Redesign

### 1. Command Center — Layout Inteligente por Tipo de Console

Redesenhar `CommandCenter.tsx` para que o **chrome** (status bar, arm controls, panic) só apareça nos modos de **disparo** (super_dmx, simple_dmx, manual_fire, pyro_fire, auto_fire, check_slave). Modos de hardware/network/system renderizam o componente diretamente sem o overhead do LiveFiringPanel.

**Desktop**: 
- Sidebar glassmorphism refinada com seções visuais claras (separadores, ícones de status por seção)
- Modos de disparo: renderizam `LiveFiringPanel` com ARM bar + CUE keys + PANIC
- Modos de hardware: renderizam componente direto (VirtualControllerHub, PBusMonitorPanel, etc.) em layout glassmorphism próprio
- Breadcrumb bar com ícone contextual por modo

**Mobile**:
- Dynamic Island expandido com timecode quando em modo de disparo
- Bottom tab bar com indicador de modo ativo animado
- Modos de disparo: full chrome (ARM + CUE + PANIC)
- Modos de hardware/network: componente direto com header simples

### 2. Consoles de Disparo — Layouts Únicos

Cada console de disparo terá identidade visual própria:

- **Super DMX**: Accent azul, grid de dispositivos dominante, CUE keys 8x2
- **Pyro XL4**: Accent vermelho, réplica do hardware, módulos na sidebar
- **Manual Fire**: Accent laranja, botões grandes de fire (2 colunas mobile, 4 desktop), FIRE ALL proeminente
- **Auto Fire**: Accent amber, timeline/sequencer visual, controles de step/timecode
- **Simple DMX**: Accent verde, sliders dominantes, layout clean de faders
- **Check Slave**: Accent cyan, diagnostics grid, status de módulos

Cada console terá um **header badge** com cor única e ícone para identificação rápida.

### 3. Tipografia — Cleanup Final

Substituir em todos os arquivos restantes:
- `text-[5px]` → `text-[8px]` (DeviceLibraryPanel, AutoFirePanel)
- `text-[6px]` → `text-[8px]` (WiFiDirectControlPanel, DeviceLibraryPanel, AutoFirePanel, CheckSlavePanel, MA3ControlPanel, ClientApprovalPanel, VideoChoreoResultPreview)

### 4. Refinamento Glassmorphism

- Adicionar `glass-card` pattern consistente no Command Center
- Cards com `backdrop-filter: blur(40px)` e borders sutis
- Transições suaves entre modos (fade + slide)

## Arquivos Afetados

1. **Editar**: `src/pages/CommandCenter.tsx` — redesign completo com routing inteligente fire vs hardware, layouts únicos por console, mobile HUD refinado
2. **Editar**: `src/components/editor/LiveFiringPanel.tsx` — aceitar prop `consoleAccent` para cor contextual por modo
3. **Editar**: `src/components/editor/live-firing/DeviceLibraryPanel.tsx` — tipografia mínima
4. **Editar**: `src/components/editor/live-firing/AutoFirePanel.tsx` — tipografia mínima
5. **Editar**: `src/components/editor/live-firing/WiFiDirectControlPanel.tsx` — tipografia mínima
6. **Editar**: `src/components/editor/live-firing/CheckSlavePanel.tsx` — tipografia mínima
7. **Editar**: `src/components/editor/MA3ControlPanel.tsx` — tipografia mínima
